import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { MaintenanceFrequency, Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type MaintenanceEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateMaintenancePlanDto, QueryMaintenancePlanDto, UpdateMaintenancePlanDto,
} from './dto/maintenance-plan.dto';
import {
  assertValidCron, computeInitialNextRun, type RecurrenceSpec,
} from './maintenance.schedule';

const SORTABLE = ['name', 'assetId', 'frequencyType', 'nextRunAt', 'lastRunAt', 'priority', 'createdAt'] as const;
const ASSET_SELECT = {
  id: true, assetCode: true, name: true, status: true, criticality: true,
  category: { select: { id: true, name: true, code: true, color: true } },
} as const;

@Injectable()
export class MaintenancePlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async create(dto: CreateMaintenancePlanDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(dto.communityId);
    await this.assertAssetInCommunity(dto.assetId, dto.communityId);

    const spec = this.specOf(dto);
    if (spec.frequencyType === MaintenanceFrequency.CUSTOM) assertValidCron(spec.cronExpression!);
    this.assertDateRange(dto.startDate, dto.endDate);
    const nextRunAt = computeInitialNextRun(spec, dto.startDate);

    const plan = await this.prisma.maintenancePlan.create({
      data: {
        tenantId: community.tenantId,
        communityId: dto.communityId,
        assetId: dto.assetId,
        name: dto.name,
        description: dto.description,
        frequencyType: dto.frequencyType,
        frequencyInterval: dto.frequencyInterval ?? 1,
        cronExpression: dto.frequencyType === MaintenanceFrequency.CUSTOM ? dto.cronExpression : null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        nextRunAt,
        priority: dto.priority ?? 'MEDIUM',
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
        requiresVerification: dto.requiresVerification ?? false,
        isActive: dto.isActive ?? true,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.publish(DomainEventName.MaintenancePlanCreated, plan, actor);
    return plan;
  }

  async findMany(query: QueryMaintenancePlanDto): Promise<Paginated<unknown>> {
    await this.access.assert(query.communityId);
    const now = new Date();
    const where: Prisma.MaintenancePlanWhereInput = {
      communityId: query.communityId,
      deletedAt: null,
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(query.categoryId ? { asset: { categoryId: query.categoryId } } : {}),
      ...(query.frequencyType ? { frequencyType: query.frequencyType } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.upcoming ? { nextRunAt: { gt: now } } : {}),
      ...(query.overdue ? { isActive: true, nextRunAt: { lte: now } } : {}),
      ...(query.search
        ? { OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { asset: { assetCode: { contains: query.search, mode: 'insensitive' } } },
            { asset: { name: { contains: query.search, mode: 'insensitive' } } },
          ] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.maintenancePlan.findMany({
        where,
        include: { asset: { select: ASSET_SELECT }, _count: { select: { checklistTemplates: true, runs: true } } },
        orderBy: resolveSort(query, SORTABLE, 'nextRunAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.maintenancePlan.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const plan = await this.prisma.maintenancePlan.findFirst({
      where: { id, deletedAt: null },
      include: {
        asset: { select: ASSET_SELECT },
        checklistTemplates: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        runs: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { runs: true } },
      },
    });
    if (!plan) throw new NotFoundException('Maintenance plan not found');
    await this.access.assert(plan.communityId);
    return plan;
  }

  async update(id: string, dto: UpdateMaintenancePlanDto, actor: AuthenticatedUser) {
    const plan = await this.loadOrThrow(id);

    const frequencyType = dto.frequencyType ?? plan.frequencyType;
    const cronExpression = dto.cronExpression ?? plan.cronExpression;
    const startDate = dto.startDate ?? plan.startDate;
    const recurrenceChanged =
      dto.frequencyType !== undefined || dto.frequencyInterval !== undefined ||
      dto.cronExpression !== undefined || dto.startDate !== undefined;

    if (frequencyType === MaintenanceFrequency.CUSTOM) {
      if (!cronExpression) throw new BadRequestException('A CUSTOM plan requires a cronExpression');
      assertValidCron(cronExpression);
    }
    this.assertDateRange(startDate, dto.endDate ?? plan.endDate);

    const nextRunAt = recurrenceChanged
      ? computeInitialNextRun(
          { frequencyType, frequencyInterval: dto.frequencyInterval ?? plan.frequencyInterval, cronExpression },
          startDate,
        )
      : undefined;

    const activation =
      dto.isActive === undefined || dto.isActive === plan.isActive
        ? null
        : dto.isActive ? 'activated' : 'paused';

    const updated = await this.prisma.maintenancePlan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        frequencyType: dto.frequencyType,
        frequencyInterval: dto.frequencyInterval,
        cronExpression: frequencyType === MaintenanceFrequency.CUSTOM ? cronExpression : (dto.frequencyType ? null : undefined),
        startDate: dto.startDate,
        endDate: dto.endDate,
        nextRunAt,
        priority: dto.priority,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
        requiresVerification: dto.requiresVerification,
        isActive: dto.isActive,
        updatedById: actor.id,
      },
    });

    if (activation === 'activated') this.publish(DomainEventName.MaintenancePlanActivated, updated, actor);
    else if (activation === 'paused') this.publish(DomainEventName.MaintenancePlanPaused, updated, actor);
    else this.publish(DomainEventName.MaintenancePlanUpdated, updated, actor);
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.loadOrThrow(id);
    await this.prisma.maintenancePlan.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  /** Loads a tenant-verified, non-deleted plan (shared with the checklist/run services). */
  async loadOrThrow(id: string) {
    const plan = await this.prisma.maintenancePlan.findFirst({ where: { id, deletedAt: null } });
    if (!plan) throw new NotFoundException('Maintenance plan not found');
    await this.access.assert(plan.communityId);
    return plan;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private specOf(dto: CreateMaintenancePlanDto): RecurrenceSpec {
    return {
      frequencyType: dto.frequencyType,
      frequencyInterval: dto.frequencyInterval ?? 1,
      cronExpression: dto.cronExpression ?? null,
    };
  }

  private assertDateRange(startDate: Date, endDate?: Date | null) {
    if (endDate && endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException('endDate must be after startDate');
    }
  }

  private async assertAssetInCommunity(assetId: string, communityId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) throw new BadRequestException('Asset does not belong to this community');
  }

  private publish(
    name: MaintenanceEvent['name'],
    plan: { id: string; communityId: string; name: string; assetId: string },
    actor: AuthenticatedUser,
    extra?: Partial<MaintenanceEvent['data']>,
  ): void {
    const event = {
      name,
      ...this.events.from(actor, plan.communityId),
      entityId: plan.id,
      data: { planName: plan.name, assetId: plan.assetId, ...extra },
    } satisfies Omit<MaintenanceEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
