import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { AMCEventType, AMCStatus, Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type AMCEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { AmcHistoryService } from './amc-history.service';
import { assertContractDates } from './amc.util';
import {
  CreateAMCContractDto, QueryAMCContractDto, RenewAMCContractDto, UpdateAMCContractDto,
} from './dto/amc-contract.dto';

const SORTABLE = ['name', 'vendorId', 'endDate', 'annualCost', 'createdAt'] as const;
const VENDOR_SELECT = { id: true, name: true, category: true, companyName: true } as const;

@Injectable()
export class AmcContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
    private readonly history: AmcHistoryService,
  ) {}

  async create(dto: CreateAMCContractDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(dto.communityId);
    await this.assertVendorCovers(dto.vendorId, community.tenantId, dto.communityId);
    assertContractDates(dto.startDate, dto.endDate);
    await this.assertContractNumberFree(community.tenantId, dto.contractNumber);

    const status = dto.status ?? AMCStatus.DRAFT;
    const contract = await this.prisma.$transaction(async (tx) => {
      const created = await tx.aMCContract.create({
        data: {
          tenantId: community.tenantId,
          communityId: dto.communityId,
          vendorId: dto.vendorId,
          contractNumber: dto.contractNumber,
          name: dto.name,
          description: dto.description,
          status,
          startDate: dto.startDate,
          endDate: dto.endDate,
          renewalReminderDays: dto.renewalReminderDays ?? 30,
          annualCost: new Prisma.Decimal(dto.annualCost),
          currency: dto.currency ?? 'INR',
          paymentFrequency: dto.paymentFrequency ?? 'YEARLY',
          contactPerson: dto.contactPerson,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          notes: dto.notes,
          autoRenew: dto.autoRenew ?? false,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      await this.history.record({ contractId: created.id, eventType: AMCEventType.CREATED, performedById: actor.id, tx });
      if (status === AMCStatus.ACTIVE) {
        await this.history.record({ contractId: created.id, eventType: AMCEventType.ACTIVATED, performedById: actor.id, tx });
      }
      return created;
    });

    this.publish(DomainEventName.AMCContractCreated, contract, actor);
    if (status === AMCStatus.ACTIVE) {
      this.publish(DomainEventName.AMCContractActivated, contract, actor, { status });
    }
    return contract;
  }

  async findMany(query: QueryAMCContractDto): Promise<Paginated<unknown>> {
    await this.access.assert(query.communityId);
    const where: Prisma.AMCContractWhereInput = {
      communityId: query.communityId,
      deletedAt: null,
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.renewalDue ? { status: AMCStatus.RENEWAL_PENDING } : query.status ? { status: query.status } : {}),
      ...(query.expiringBefore ? { endDate: { lte: query.expiringBefore } } : {}),
      ...(query.assetId || query.coverageType
        ? { coverages: { some: {
            ...(query.assetId ? { assetId: query.assetId } : {}),
            ...(query.coverageType ? { coverageType: query.coverageType } : {}),
          } } }
        : {}),
      ...(query.search
        ? { OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { contractNumber: { contains: query.search, mode: 'insensitive' } },
            { vendor: { name: { contains: query.search, mode: 'insensitive' } } },
          ] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aMCContract.findMany({
        where,
        include: { vendor: { select: VENDOR_SELECT }, _count: { select: { coverages: true, slaRules: true } } },
        orderBy: resolveSort(query, SORTABLE, 'endDate'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.aMCContract.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const contract = await this.prisma.aMCContract.findFirst({
      where: { id, deletedAt: null },
      include: {
        vendor: { select: VENDOR_SELECT },
        coverages: {
          orderBy: { createdAt: 'asc' },
          include: { asset: { select: { id: true, assetCode: true, name: true, status: true } } },
        },
        slaRules: { orderBy: { priority: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!contract) throw new NotFoundException('AMC contract not found');
    await this.access.assert(contract.communityId);
    return contract;
  }

  async update(id: string, dto: UpdateAMCContractDto, actor: AuthenticatedUser) {
    const contract = await this.loadOrThrow(id);

    if (dto.vendorId && dto.vendorId !== contract.vendorId) {
      await this.assertVendorCovers(dto.vendorId, contract.tenantId, contract.communityId);
    }
    const startDate = dto.startDate ?? contract.startDate;
    const endDate = dto.endDate ?? contract.endDate;
    if (dto.startDate || dto.endDate) assertContractDates(startDate, endDate);

    const nextStatus = dto.status ?? contract.status;
    const statusChanged = nextStatus !== contract.status;

    const updated = await this.prisma.aMCContract.update({
      where: { id },
      data: {
        vendorId: dto.vendorId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate,
        endDate: dto.endDate,
        renewalReminderDays: dto.renewalReminderDays,
        annualCost: dto.annualCost != null ? new Prisma.Decimal(dto.annualCost) : undefined,
        currency: dto.currency,
        paymentFrequency: dto.paymentFrequency,
        contactPerson: dto.contactPerson,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        notes: dto.notes,
        autoRenew: dto.autoRenew,
        updatedById: actor.id,
      },
    });

    await this.history.record({
      contractId: id,
      eventType: this.historyTypeForStatus(statusChanged ? nextStatus : null),
      performedById: actor.id,
      metadata: statusChanged ? { from: contract.status, to: nextStatus } : undefined,
    });
    if (statusChanged && nextStatus === AMCStatus.ACTIVE) {
      this.publish(DomainEventName.AMCContractActivated, updated, actor, { status: nextStatus, fromStatus: contract.status });
    } else if (statusChanged && nextStatus === AMCStatus.EXPIRED) {
      this.publish(DomainEventName.AMCContractExpired, updated, actor, { status: nextStatus, fromStatus: contract.status });
    }
    return updated;
  }

  async renew(id: string, dto: RenewAMCContractDto, actor: AuthenticatedUser) {
    const contract = await this.loadOrThrow(id);
    const startDate = dto.startDate ?? contract.endDate;
    assertContractDates(startDate, dto.endDate);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.aMCContract.update({
        where: { id },
        data: {
          startDate,
          endDate: dto.endDate,
          annualCost: dto.annualCost != null ? new Prisma.Decimal(dto.annualCost) : undefined,
          notes: dto.notes,
          status: AMCStatus.ACTIVE,
          updatedById: actor.id,
        },
      });
      await this.history.record({
        contractId: id, eventType: AMCEventType.RENEWED, performedById: actor.id,
        metadata: { previousEndDate: contract.endDate, newEndDate: dto.endDate },
        tx,
      });
      return row;
    });
    this.publish(DomainEventName.AMCContractRenewed, updated, actor, { status: AMCStatus.ACTIVE });
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.loadOrThrow(id);
    await this.prisma.aMCContract.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  getHistory(id: string) {
    return this.loadOrThrow(id).then(() => this.history.list(id));
  }

  /** Tenant-verified, non-deleted contract (shared with coverage/SLA services). */
  async loadOrThrow(id: string) {
    const contract = await this.prisma.aMCContract.findFirst({ where: { id, deletedAt: null } });
    if (!contract) throw new NotFoundException('AMC contract not found');
    await this.access.assert(contract.communityId);
    return contract;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private historyTypeForStatus(status: AMCStatus | null): AMCEventType {
    switch (status) {
      case AMCStatus.ACTIVE: return AMCEventType.ACTIVATED;
      case AMCStatus.EXPIRED: return AMCEventType.EXPIRED;
      case AMCStatus.TERMINATED: return AMCEventType.TERMINATED;
      default: return AMCEventType.UPDATED;
    }
  }

  private async assertContractNumberFree(tenantId: string, contractNumber: string) {
    const existing = await this.prisma.aMCContract.findFirst({
      where: { tenantId, contractNumber, deletedAt: null },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`Contract number "${contractNumber}" already exists`);
  }

  private async assertVendorCovers(vendorId: string, tenantId: string, communityId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null, communityIds: { has: communityId } },
      select: { id: true },
    });
    if (!vendor) throw new BadRequestException('Vendor does not cover this community');
  }

  private publish(
    name: AMCEvent['name'],
    contract: { id: string; communityId: string; tenantId: string; contractNumber: string; vendorId: string },
    actor: AuthenticatedUser,
    extra?: Partial<AMCEvent['data']>,
  ): void {
    const event = {
      name,
      tenantId: contract.tenantId,
      communityId: contract.communityId,
      actorId: actor.id,
      entityId: contract.id,
      data: { contractNumber: contract.contractNumber, vendorId: contract.vendorId, ...extra },
    } satisfies Omit<AMCEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
