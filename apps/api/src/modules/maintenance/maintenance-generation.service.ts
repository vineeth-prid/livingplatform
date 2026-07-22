import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { MaintenanceRunStatus, Prisma, WorkOrderOriginType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { DomainEventName, type MaintenanceEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkOrderDto } from '../work-order/dto/work-order.dto';
import { WorkOrderService } from '../work-order/work-order.service';
import { advanceNextRun } from './maintenance.schedule';

type Plan = Prisma.MaintenancePlanGetPayload<Record<string, never>>;

/**
 * Turns a due maintenance plan into a Work Order — through the EXISTING Work
 * Order Engine, never re-implementing execution. WorkOrderService is
 * request-scoped (it depends on the request-scoped TenantContextService), so we
 * resolve it per-generation via ModuleRef with a synthetic system principal —
 * the idiomatic Nest way to call a request-scoped service from a singleton
 * (scheduler) context.
 */
@Injectable()
export class MaintenanceGenerationService {
  private readonly logger = new Logger(MaintenanceGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventsService,
    private readonly audit: AuditService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Scheduler entry point: generate for every plan that is due right now. */
  async processDuePlans(now = new Date()): Promise<{ processed: number }> {
    const due = await this.prisma.maintenancePlan.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        nextRunAt: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      take: 200,
    });

    let processed = 0;
    for (const plan of due) {
      try {
        const did = await this.generateScheduled(plan, now);
        if (did) processed++;
      } catch (err) {
        this.logger.error(`PM generation failed for plan ${plan.id}`, err as Error);
      }
    }
    return { processed };
  }

  /**
   * Claim + generate for a due plan. The claim is a compare-and-swap on
   * nextRunAt (advance it atomically); only the worker that wins the CAS
   * generates — so a plan is never double-generated, even across ticks/instances.
   */
  private async generateScheduled(plan: Plan, now: Date): Promise<boolean> {
    const advanced = advanceNextRun(plan.nextRunAt, plan, now);
    const claim = await this.prisma.maintenancePlan.updateMany({
      where: { id: plan.id, nextRunAt: plan.nextRunAt, isActive: true, deletedAt: null },
      data: { nextRunAt: advanced, lastRunAt: now },
    });
    if (claim.count !== 1) return false; // someone else already generated this slot

    const actor = this.systemActor(plan.tenantId);
    await this.generate(plan, plan.nextRunAt, 'SCHEDULED', actor);
    return true;
  }

  /** Manual, on-demand generation (maintenance:generate). Does not touch the schedule. */
  async generateNow(plan: Plan, actor: AuthenticatedUser) {
    if (!plan.isActive) {
      throw new BadRequestException('An inactive plan cannot generate work orders');
    }
    const run = await this.generate(plan, new Date(), 'MANUAL', actor);
    if (run.status !== MaintenanceRunStatus.GENERATED) {
      throw new BadRequestException(run.notes ?? 'Could not generate a work order for this plan');
    }
    return run;
  }

  // ── core ─────────────────────────────────────────────────────────────────────

  private async generate(
    plan: Plan,
    scheduledAt: Date,
    reason: 'SCHEDULED' | 'MANUAL',
    actor: AuthenticatedUser,
  ) {
    // The asset may have been archived since the plan was written — skip cleanly.
    const asset = await this.prisma.asset.findFirst({
      where: { id: plan.assetId, communityId: plan.communityId, deletedAt: null },
      select: { id: true, assetCode: true, name: true, unitId: true },
    });
    if (!asset) {
      const run = await this.recordRun(plan, scheduledAt, MaintenanceRunStatus.SKIPPED, reason, {
        notes: 'Asset no longer available',
      });
      this.publish(DomainEventName.MaintenanceRunSkipped, plan, actor, { runId: run.id, reason: 'asset_unavailable' });
      return run;
    }

    try {
      const checklist = await this.prisma.maintenanceChecklistTemplate.findMany({
        where: { planId: plan.id, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, title: true, isMandatory: true, sortOrder: true, instructions: true },
      });

      const dto: CreateWorkOrderDto = {
        title: plan.name,
        description: plan.description?.trim()
          ? plan.description
          : `Preventive maintenance for ${asset.assetCode} — ${asset.name}.`,
        unitId: asset.unitId ?? undefined,
        priority: plan.priority,
        originType: WorkOrderOriginType.PREVENTIVE_MAINTENANCE,
        originId: plan.id,
        estimatedHours: plan.estimatedDurationMinutes != null
          ? Math.round((plan.estimatedDurationMinutes / 60) * 100) / 100
          : undefined,
        dueDate: scheduledAt,
        metadata: {
          maintenancePlanId: plan.id,
          assetId: plan.assetId,
          requiresVerification: plan.requiresVerification,
          checklist,
        },
      };

      const wos = await this.resolveWorkOrderService(actor);
      const workOrder = (await wos.create(plan.communityId, dto, actor)) as { id: string };

      // Populate the loose assetId reference on the generated WO (column added in
      // Sprint 7 for exactly this — the WO engine's code is not modified).
      await this.prisma.workOrder.update({ where: { id: workOrder.id }, data: { assetId: plan.assetId } });

      const run = await this.recordRun(plan, scheduledAt, MaintenanceRunStatus.GENERATED, reason, {
        generatedWorkOrderId: workOrder.id,
        executedAt: new Date(),
      });

      this.publish(DomainEventName.MaintenanceRunGenerated, plan, actor, { runId: run.id, workOrderId: workOrder.id });
      this.publish(DomainEventName.MaintenanceWorkOrderCreated, plan, actor, { runId: run.id, workOrderId: workOrder.id });
      void this.audit.record({
        action: 'maintenance.generate',
        resource: 'maintenance-plans',
        resourceId: plan.id,
        actorId: actor.id,
        actorEmail: actor.email,
        tenantId: plan.tenantId,
        communityId: plan.communityId,
        metadata: { workOrderId: workOrder.id, reason },
      });
      return run;
    } catch (err) {
      this.logger.error(`Work order generation failed for plan ${plan.id}`, err as Error);
      return this.recordRun(plan, scheduledAt, MaintenanceRunStatus.FAILED, reason, {
        notes: err instanceof Error ? err.message : 'Work order generation failed',
      });
    }
  }

  private recordRun(
    plan: Plan,
    scheduledAt: Date,
    status: MaintenanceRunStatus,
    reason: string,
    extra: { generatedWorkOrderId?: string; executedAt?: Date; notes?: string },
  ) {
    return this.prisma.maintenanceRun.create({
      data: {
        planId: plan.id,
        scheduledAt,
        status,
        generationReason: reason,
        generatedWorkOrderId: extra.generatedWorkOrderId,
        executedAt: extra.executedAt,
        notes: extra.notes,
      },
    });
  }

  private async resolveWorkOrderService(actor: AuthenticatedUser): Promise<WorkOrderService> {
    const contextId = ContextIdFactory.create();
    this.moduleRef.registerRequestByContextId({ user: actor }, contextId);
    return this.moduleRef.resolve(WorkOrderService, contextId, { strict: false });
  }

  /** A platform-scoped system principal so the scheduler may act across tenants. */
  private systemActor(tenantId: string): AuthenticatedUser {
    return {
      id: 'system:preventive-maintenance',
      email: 'preventive-maintenance@living.system',
      tenantId,
      roles: [{ key: 'SYSTEM', scope: 'PLATFORM', communityId: null }],
      permissions: [],
    };
  }

  private publish(
    name: MaintenanceEvent['name'],
    plan: { id: string; communityId: string; name: string; assetId: string; tenantId: string },
    actor: AuthenticatedUser,
    extra?: Partial<MaintenanceEvent['data']>,
  ): void {
    const event = {
      name,
      tenantId: plan.tenantId,
      communityId: plan.communityId,
      actorId: actor.id,
      entityId: plan.id,
      data: { planName: plan.name, assetId: plan.assetId, ...extra },
    } satisfies Omit<MaintenanceEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
