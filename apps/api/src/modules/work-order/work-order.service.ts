import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkOrderEventType, WorkOrderStatus } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import type { WorkOrderEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  ApproveWorkOrderDto,
  AssignWorkOrderDto,
  ChangeWorkOrderStatusDto,
  CreateWorkOrderDto,
  QueryWorkOrderDto,
  RejectWorkOrderDto,
  UpdateWorkOrderDto,
  VerifyWorkOrderDto,
} from './dto/work-order.dto';
import { WorkOrderStatusService } from './work-order-status.service';
import { WorkOrderTimelineService } from './work-order-timeline.service';

const SORTABLE = ['number', 'createdAt', 'priority', 'status', 'dueDate'] as const;
const W = WorkOrderStatus;

export function formatWorkOrderNumber(n: number): string {
  return `WO-${String(n).padStart(6, '0')}`;
}

@Injectable()
export class WorkOrderService {
  private readonly logger = new Logger(WorkOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly statusFlow: WorkOrderStatusService,
    private readonly timeline: WorkOrderTimelineService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
  ) {}

  /**
   * Manual / EMERGENCY work order — skips approval and starts at DRAFT (fire
   * system failure, burst pipe, …). Gated to managers via WORKORDER_CREATE.
   */
  async create(communityId: string, dto: CreateWorkOrderDto, actor: AuthenticatedUser) {
    return this.persistNew(communityId, dto, actor, { recommended: false });
  }

  /**
   * Recommend a work order for approval — the normal path. A Work Order is
   * APPROVED work, so recommendations start PENDING_APPROVAL and only reach the
   * execution lane once a manager approves.
   */
  async recommend(communityId: string, dto: CreateWorkOrderDto, actor: AuthenticatedUser) {
    const workOrder = await this.persistNew(communityId, dto, actor, { recommended: true });
    // Park the ticket: there is nothing for staff to do until the spend is
    // decided, and leaving it IN_PROGRESS misreports it to the resident.
    await this.holdOrigin(
      { id: workOrder.id, originType: dto.originType ?? null, originId: dto.originId ?? null },
      actor,
    );
    return workOrder;
  }

  private async persistNew(
    communityId: string,
    dto: CreateWorkOrderDto,
    actor: AuthenticatedUser,
    opts: { recommended: boolean },
  ) {
    await this.access.assert(communityId);
    if (dto.unitId) await this.assertUnitInCommunity(dto.unitId, communityId);

    const workOrder = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workOrder.create({
        data: {
          communityId,
          unitId: dto.unitId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? 'MEDIUM',
          status: opts.recommended ? W.PENDING_APPROVAL : W.DRAFT,
          originType: dto.originType ?? 'MANUAL',
          originId: dto.originId,
          requestedById: actor.id,
          requestedDate: new Date(),
          recommendedById: opts.recommended ? actor.id : undefined,
          estimatedHours: dto.estimatedHours,
          ...this.costFields(dto),
          dueDate: dto.dueDate,
          notes: dto.notes,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      await this.timeline.record({
        workOrderId: created.id,
        type: opts.recommended ? WorkOrderEventType.RECOMMENDED : WorkOrderEventType.CREATED,
        actorId: actor.id,
        tx,
      });
      return created;
    });

    // A recommendation is a request for a DECISION, not an announcement that
    // work exists — it has to reach approvers and the resident waiting on it.
    this.publish(
      opts.recommended ? DomainEventName.WorkOrderRecommended : DomainEventName.WorkOrderCreated,
      workOrder,
      actor,
    );
    return this.present(workOrder);
  }

  /** Approve a recommended work order → APPROVED (enters the execution lane). */
  async approve(id: string, dto: ApproveWorkOrderDto, actor: AuthenticatedUser) {
    const workOrder = await this.loadOrThrow(id);
    this.statusFlow.assertTransition(workOrder.status, W.APPROVED);
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { status: W.APPROVED, approvedById: actor.id, approvedDate: new Date(), updatedById: actor.id },
    });
    await this.timeline.record({
      workOrderId: id,
      type: WorkOrderEventType.APPROVED,
      actorId: actor.id,
      metadata: dto.remarks ? { remarks: dto.remarks } : undefined,
    });
    // The ticket was parked when the money question was raised; the answer has
    // arrived, so hand it back to the person waiting on it.
    await this.resumeOrigin(workOrder, actor, 'approved');
    this.publish(DomainEventName.WorkOrderApproved, updated, actor);
    return this.present(updated);
  }

  /**
   * Reject a recommended work order → REJECTED (terminal), with a reason.
   *
   * Rejection is a decision about the SPENDING, not about the problem. The
   * ticket comes off hold and the staff member carries on and resolves it
   * without the paid work — leaving it parked would strand the resident on a
   * decision that was already made.
   */
  async reject(id: string, dto: RejectWorkOrderDto, actor: AuthenticatedUser) {
    const workOrder = await this.loadOrThrow(id);
    this.statusFlow.assertTransition(workOrder.status, W.REJECTED);
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { status: W.REJECTED, rejectionReason: dto.reason, updatedById: actor.id },
    });
    await this.timeline.record({
      workOrderId: id,
      type: WorkOrderEventType.REJECTED,
      actorId: actor.id,
      metadata: { reason: dto.reason },
    });
    await this.resumeOrigin(workOrder, actor, 'rejected');
    this.publish(DomainEventName.WorkOrderRejected, updated, actor);
    return this.present(updated);
  }

  /**
   * Park the originating ticket while a manager decides on the spend.
   *
   * Staff have no action to take until the answer comes back, so the ticket
   * moves to ON_HOLD rather than sitting in IN_PROGRESS looking like someone is
   * working on it. Best-effort: the work order is already recorded, and a
   * failure here must not undo that.
   */
  private async holdOrigin(
    workOrder: { id: string; originType: string | null; originId: string | null },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (workOrder.originType !== 'TICKET' || !workOrder.originId) return;
    try {
      await this.prisma.ticket.updateMany({
        where: { id: workOrder.originId, deletedAt: null, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
        data: { status: 'ON_HOLD', updatedById: actor.id },
      });
    } catch (err) {
      this.logger.warn(`Could not hold ticket ${workOrder.originId}: ${(err as Error).message}`);
    }
  }

  /** Take the originating ticket off hold once the spend decision is made. */
  private async resumeOrigin(
    workOrder: { id: string; originType: string | null; originId: string | null },
    actor: AuthenticatedUser,
    _outcome: 'approved' | 'rejected',
  ): Promise<void> {
    if (workOrder.originType !== 'TICKET' || !workOrder.originId) return;
    try {
      await this.prisma.ticket.updateMany({
        where: { id: workOrder.originId, deletedAt: null, status: 'ON_HOLD' },
        data: { status: 'IN_PROGRESS', updatedById: actor.id },
      });
    } catch (err) {
      this.logger.warn(`Could not resume ticket ${workOrder.originId}: ${(err as Error).message}`);
    }
  }

  /**
   * Site evidence is a precondition, not a nicety.
   *
   * A BEFORE photo has to exist before work starts, and an AFTER photo before it
   * is called complete. Enforced on the API rather than in the app because it is
   * the record the resident and the admin rely on to see what was actually done
   * — a client-side check would be advisory, and the one time it mattered would
   * be the time somebody worked around it.
   *
   * The message says which photo is missing; "invalid transition" would send a
   * staff member hunting for a status problem that does not exist.
   */
  private async assertEvidence(workOrderId: string, to: WorkOrderStatus): Promise<void> {
    const stage =
      to === W.IN_PROGRESS ? 'BEFORE' : to === W.COMPLETED ? 'AFTER' : null;
    if (!stage) return;

    const count = await this.prisma.workOrderAttachment.count({
      where: { workOrderId, deletedAt: null, stage },
    });
    if (count > 0) return;

    throw new BadRequestException(
      stage === 'BEFORE'
        ? 'Take a “before” photo of the site before starting work.'
        : 'Take an “after” photo showing the finished work before completing it.',
    );
  }

  /** Estimated total is stored (labour + material) whenever either is provided. */
  private costFields(dto: { estimatedLabourCost?: number; estimatedMaterialCost?: number }) {
    const { estimatedLabourCost: labour, estimatedMaterialCost: material } = dto;
    return {
      estimatedLabourCost: labour,
      estimatedMaterialCost: material,
      estimatedTotalCost:
        labour != null || material != null ? (labour ?? 0) + (material ?? 0) : undefined,
    };
  }

  /**
   * Work orders raised against the caller's OWN unit(s).
   *
   * Self-service, so it carries no RBAC permission — residents hold none of the
   * work-order permissions by design, yet maintenance happening in their flat is
   * exactly the thing they should be able to follow. Scoped by the caller's own
   * resident records, so there is nothing to leak.
   *
   * Internal updates and cost estimates are stripped: a resident should see that
   * work is happening and where it has got to, not the contractor's pricing.
   */
  async findMine(query: QueryWorkOrderDto, actor: AuthenticatedUser): Promise<Paginated<unknown>> {
    const assignments = await this.prisma.residentUnit.findMany({
      where: { resident: { userId: actor.id, deletedAt: null } },
      select: { unitId: true },
    });
    const unitIds = [...new Set(assignments.map((a) => a.unitId))];
    if (unitIds.length === 0) return paginate([], 0, query);

    const where: Prisma.WorkOrderWhereInput = {
      deletedAt: null,
      unitId: { in: unitIds },
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
        select: {
          id: true, number: true, title: true, description: true,
          status: true, priority: true, unitId: true,
          dueDate: true, startedDate: true, completedDate: true,
          createdAt: true, updatedAt: true,
        },
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findMany(communityId: string, query: QueryWorkOrderDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.WorkOrderWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.originType ? { originType: query.originType } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.assignedStaffId ? { assignedStaffId: query.assignedStaffId } : {}),
      ...(query.assignedVendorId ? { assignedVendorId: query.assignedVendorId } : {}),
      ...(query.blockId || query.floorId
        ? { unit: { ...(query.blockId ? { blockId: query.blockId } : {}), ...(query.floorId ? { floorId: query.floorId } : {}) } }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.search ? this.searchWhere(query.search) : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where,
        include: { unit: { select: { id: true, unitNumber: true, blockId: true, floorId: true } } },
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.workOrder.count({ where }),
    ]);
    return paginate(items.map((w) => this.present(w)), total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        unit: { select: { id: true, unitNumber: true, blockId: true, floorId: true } },
        updates: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!workOrder) throw new NotFoundException('Work order not found');
    await this.access.assert(workOrder.communityId);

    const canSeeInternal = actor.permissions.includes(PERMISSIONS.WORKORDER_UPDATE);
    return {
      ...this.present(workOrder),
      assignee: await this.resolveAssignee(workOrder),
      updates: workOrder.updates.filter((u) => canSeeInternal || !u.isInternal),
      // Signed, not public: the bucket is private, so a public URL 403s and the
      // attachment appears broken in the portal.
      attachments: await Promise.all(
        workOrder.attachments.map(async (a) => ({
          ...a,
          downloadUrl: (await this.storage.signDownload(a.storageKey)).url,
        })),
      ),
    };
  }

  async update(id: string, dto: UpdateWorkOrderDto, actor: AuthenticatedUser) {
    const workOrder = await this.loadOrThrow(id);
    if (this.statusFlow.isTerminal(workOrder.status)) {
      throw new ForbiddenException(
        `A ${workOrder.status.toLowerCase()} work order is read-only`,
      );
    }
    if (dto.unitId) await this.assertUnitInCommunity(dto.unitId, workOrder.communityId);
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        unitId: dto.unitId,
        priority: dto.priority,
        estimatedHours: dto.estimatedHours,
        ...this.costFields(dto),
        actualHours: dto.actualHours,
        dueDate: dto.dueDate,
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
    return this.present(updated);
  }

  async changeStatus(id: string, dto: ChangeWorkOrderStatusDto, actor: AuthenticatedUser) {
    const workOrder = await this.loadOrThrow(id);
    const from = workOrder.status;
    const to = dto.status;
    if (to === W.VERIFIED) {
      throw new BadRequestException('Use the verify endpoint to verify a work order');
    }
    if (to === W.APPROVED || to === W.REJECTED) {
      throw new BadRequestException('Use the approve / reject endpoint for approval decisions');
    }
    this.statusFlow.assertTransition(from, to);
    this.assertStatusPermission(to, actor);
    await this.assertEvidence(id, to);

    const now = new Date();
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: to,
        startedDate: to === W.IN_PROGRESS && !workOrder.startedDate ? now : undefined,
        completedDate: to === W.COMPLETED ? now : undefined,
        updatedById: actor.id,
      },
    });
    await this.timeline.record({
      workOrderId: id,
      type: this.eventTypeForStatus(to, from),
      actorId: actor.id,
      reference: `${from}->${to}`,
      metadata: dto.note ? { note: dto.note } : undefined,
    });

    const eventName = this.domainEventForStatus(to);
    if (eventName) this.publish(eventName, workOrder, actor, { status: to });
    return this.present(updated);
  }

  /** Verify a completed work order (Facility Manager / Association Admin only, via RBAC). */
  async verify(id: string, dto: VerifyWorkOrderDto, actor: AuthenticatedUser) {
    const workOrder = await this.loadOrThrow(id);
    this.statusFlow.assertTransition(workOrder.status, W.VERIFIED);
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: W.VERIFIED,
        verifiedById: actor.id,
        verifiedDate: new Date(),
        verificationRemarks: dto.remarks,
        updatedById: actor.id,
      },
    });
    await this.timeline.record({
      workOrderId: id,
      type: WorkOrderEventType.VERIFIED,
      actorId: actor.id,
      metadata: dto.remarks ? { remarks: dto.remarks } : undefined,
    });
    this.publish(DomainEventName.WorkVerified, workOrder, actor, { status: W.VERIFIED });
    return this.present(updated);
  }

  async assign(id: string, dto: AssignWorkOrderDto, actor: AuthenticatedUser) {
    const workOrder = await this.loadOrThrow(id);
    const community = await this.access.assert(workOrder.communityId);

    const hasStaff = !!dto.staffId;
    const hasVendor = !!dto.vendorId;
    if (hasStaff === hasVendor) {
      throw new BadRequestException('Assign to exactly one of staffId or vendorId');
    }
    if (dto.staffId) await this.assertStaffInCommunity(dto.staffId, workOrder.communityId);
    if (dto.vendorId) await this.assertVendorCovers(dto.vendorId, community.tenantId, workOrder.communityId);

    const wasAssigned = !!(workOrder.assignedStaffId || workOrder.assignedVendorId);
    const nextStatus =
      workOrder.status === W.DRAFT || workOrder.status === W.APPROVED
        ? W.ASSIGNED
        : workOrder.status;

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        assignedStaffId: dto.staffId ?? null,
        assignedVendorId: dto.vendorId ?? null,
        assignedById: actor.id,
        assignedAt: new Date(),
        reassignedCount: wasAssigned ? { increment: 1 } : undefined,
        status: nextStatus,
        updatedById: actor.id,
      },
    });
    await this.timeline.record({
      workOrderId: id,
      type: wasAssigned ? WorkOrderEventType.REASSIGNED : WorkOrderEventType.ASSIGNED,
      actorId: actor.id,
      reference: dto.staffId ?? dto.vendorId,
      metadata: { assigneeType: dto.staffId ? 'staff' : 'vendor', ...(dto.note ? { note: dto.note } : {}) },
    });
    this.publish(DomainEventName.WorkOrderAssigned, workOrder, actor, {
      assigneeType: dto.staffId ? 'staff' : 'vendor',
      assigneeId: dto.staffId ?? dto.vendorId,
    });
    return this.present(updated);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.loadOrThrow(id);
    await this.prisma.workOrder.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  async getTimeline(id: string) {
    await this.loadOrThrow(id);
    return this.timeline.list(id);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async loadOrThrow(id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!workOrder) throw new NotFoundException('Work order not found');
    await this.access.assert(workOrder.communityId);
    return workOrder;
  }

  private assertStatusPermission(to: WorkOrderStatus, actor: AuthenticatedUser): void {
    const need =
      to === W.IN_PROGRESS
        ? PERMISSIONS.WORKORDER_START
        : to === W.COMPLETED
          ? PERMISSIONS.WORKORDER_COMPLETE
          : to === W.CLOSED
            ? PERMISSIONS.WORKORDER_CLOSE
            : PERMISSIONS.WORKORDER_UPDATE;
    if (!actor.permissions.includes(need)) {
      throw new ForbiddenException(`Missing required permission: ${need}`);
    }
  }

  private eventTypeForStatus(to: WorkOrderStatus, from: WorkOrderStatus): WorkOrderEventType {
    switch (to) {
      case W.ACCEPTED:
        return WorkOrderEventType.ACCEPTED;
      case W.IN_PROGRESS:
        return from === W.ON_HOLD
          ? WorkOrderEventType.RESUMED
          : WorkOrderEventType.STARTED;
      case W.ON_HOLD:
        return WorkOrderEventType.ON_HOLD;
      case W.COMPLETED:
        return WorkOrderEventType.COMPLETED;
      case W.CLOSED:
        return WorkOrderEventType.CLOSED;
      default:
        return WorkOrderEventType.CANCELLED;
    }
  }

  private domainEventForStatus(to: WorkOrderStatus) {
    switch (to) {
      case W.IN_PROGRESS:
        return DomainEventName.WorkStarted;
      case W.COMPLETED:
        return DomainEventName.WorkCompleted;
      case W.CLOSED:
        return DomainEventName.WorkClosed;
      default:
        return null;
    }
  }

  private publish(
    name: WorkOrderEvent['name'],
    workOrder: { id: string; communityId: string; number: number },
    actor: AuthenticatedUser,
    extra?: Partial<WorkOrderEvent['data']>,
  ): void {
    const event = {
      name,
      ...this.events.from(actor, workOrder.communityId),
      entityId: workOrder.id,
      data: { workOrderNumber: formatWorkOrderNumber(workOrder.number), ...extra },
    } satisfies Omit<WorkOrderEvent, 'occurredAt'>;
    this.events.publish(event);
  }

  private async resolveAssignee(workOrder: {
    assignedStaffId: string | null;
    assignedVendorId: string | null;
  }) {
    if (workOrder.assignedStaffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: workOrder.assignedStaffId },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      return staff ? { type: 'staff' as const, ...staff } : null;
    }
    if (workOrder.assignedVendorId) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: workOrder.assignedVendorId },
        select: { id: true, name: true, category: true },
      });
      return vendor ? { type: 'vendor' as const, ...vendor } : null;
    }
    return null;
  }

  private searchWhere(search: string): Prisma.WorkOrderWhereInput {
    const contains = { contains: search, mode: 'insensitive' as const };
    const digits = search.replace(/\D/g, '');
    const or: Prisma.WorkOrderWhereInput[] = [
      { title: contains },
      { unit: { unitNumber: contains } },
    ];
    if (digits) or.push({ number: Number(digits) });
    return { OR: or };
  }

  private async assertUnitInCommunity(unitId: string, communityId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!unit) throw new BadRequestException('Unit does not belong to this community');
  }

  private async assertStaffInCommunity(staffId: string, communityId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!staff) throw new BadRequestException('Staff does not belong to this community');
  }

  private async assertVendorCovers(vendorId: string, tenantId: string, communityId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null, communityIds: { has: communityId } },
      select: { id: true },
    });
    if (!vendor) throw new BadRequestException('Vendor does not cover this community');
  }

  private present<T extends { number: number }>(workOrder: T) {
    return { ...workOrder, workOrderNumber: formatWorkOrderNumber(workOrder.number) };
  }
}
