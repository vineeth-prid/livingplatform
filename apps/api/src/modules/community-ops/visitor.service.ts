import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, VisitorStatus } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type VisitorEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateVisitorDto, QueryVisitorDto, RejectVisitorDto, UpdateVisitorDto,
} from './dto/visitor.dto';
import { generatePassCode } from './passcode';
import { assertResidentOwnership, myResidentIds } from './resident-access';

const SORTABLE = ['expectedArrival', 'status', 'createdAt'] as const;
const V = VisitorStatus;

@Injectable()
export class VisitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async create(dto: CreateVisitorDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(dto.communityId);
    await assertResidentOwnership(this.prisma, dto.residentId, dto.communityId, actor, PERMISSIONS.VISITOR_APPROVE);

    const visitor = await this.prisma.visitor.create({
      data: {
        tenantId: community.tenantId,
        communityId: dto.communityId,
        residentId: dto.residentId,
        visitorName: dto.visitorName,
        mobileNumber: dto.mobileNumber,
        vehicleNumber: dto.vehicleNumber,
        visitorType: dto.visitorType ?? 'GUEST',
        purpose: dto.purpose,
        expectedArrival: dto.expectedArrival,
        notes: dto.notes,
        passCode: await this.uniquePassCode(),
        status: V.PENDING,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.publish(DomainEventName.VisitorCreated, visitor, actor, { passCode: visitor.passCode });
    return visitor;
  }

  async findMany(query: QueryVisitorDto, actor: AuthenticatedUser): Promise<Paginated<unknown>> {
    await this.access.assert(query.communityId);
    const where: Prisma.VisitorWhereInput = {
      communityId: query.communityId,
      deletedAt: null,
      ...(await this.residentScope(query, actor)),
      ...(query.status ? { status: query.status } : {}),
      ...(query.visitorType ? { visitorType: query.visitorType } : {}),
      ...(query.dateFrom || query.dateTo
        ? { expectedArrival: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
        : {}),
      ...(query.search
        ? { OR: [
            { visitorName: { contains: query.search, mode: 'insensitive' } },
            { mobileNumber: { contains: query.search } },
            { passCode: { contains: query.search.toUpperCase() } },
          ] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.visitor.findMany({
        where,
        include: { resident: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: resolveSort(query, SORTABLE, 'expectedArrival'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.visitor.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const visitor = await this.loadOrThrow(id);
    await this.assertCanView(visitor, actor);
    return visitor;
  }

  async update(id: string, dto: UpdateVisitorDto, actor: AuthenticatedUser) {
    const visitor = await this.loadOrThrow(id);
    await assertResidentOwnership(this.prisma, visitor.residentId, visitor.communityId, actor, PERMISSIONS.VISITOR_APPROVE);
    if (visitor.status !== V.PENDING && visitor.status !== V.APPROVED) {
      throw new ForbiddenException('Only a pending or approved visit can be edited');
    }
    return this.prisma.visitor.update({
      where: { id },
      data: {
        visitorName: dto.visitorName,
        mobileNumber: dto.mobileNumber,
        vehicleNumber: dto.vehicleNumber,
        visitorType: dto.visitorType,
        purpose: dto.purpose,
        expectedArrival: dto.expectedArrival,
        notes: dto.notes,
        updatedById: actor.id,
      },
    });
  }

  async approve(id: string, actor: AuthenticatedUser) {
    const visitor = await this.loadOrThrow(id);
    this.assertStatus(visitor.status, [V.PENDING], 'approved');
    const updated = await this.prisma.visitor.update({
      where: { id },
      data: { status: V.APPROVED, approvedById: actor.id, updatedById: actor.id },
    });
    this.publish(DomainEventName.VisitorApproved, updated, actor, { status: V.APPROVED });
    return updated;
  }

  async reject(id: string, dto: RejectVisitorDto, actor: AuthenticatedUser) {
    const visitor = await this.loadOrThrow(id);
    this.assertStatus(visitor.status, [V.PENDING, V.APPROVED], 'rejected');
    return this.prisma.visitor.update({
      where: { id },
      data: {
        status: V.REJECTED,
        notes: dto.reason ?? visitor.notes,
        approvedById: actor.id,
        updatedById: actor.id,
      },
    });
  }

  async checkIn(id: string, actor: AuthenticatedUser) {
    const visitor = await this.loadOrThrow(id);
    this.assertStatus(visitor.status, [V.APPROVED], 'checked in');
    const updated = await this.prisma.visitor.update({
      where: { id },
      data: { status: V.CHECKED_IN, actualCheckIn: new Date(), updatedById: actor.id },
    });
    this.publish(DomainEventName.VisitorCheckedIn, updated, actor, { status: V.CHECKED_IN });
    return updated;
  }

  async checkOut(id: string, actor: AuthenticatedUser) {
    const visitor = await this.loadOrThrow(id);
    this.assertStatus(visitor.status, [V.CHECKED_IN], 'checked out');
    const updated = await this.prisma.visitor.update({
      where: { id },
      data: { status: V.CHECKED_OUT, actualCheckOut: new Date(), updatedById: actor.id },
    });
    this.publish(DomainEventName.VisitorCheckedOut, updated, actor, { status: V.CHECKED_OUT });
    return updated;
  }

  /** Resident (or manager) cancels a visit — soft-deletes it. */
  async cancel(id: string, actor: AuthenticatedUser) {
    const visitor = await this.loadOrThrow(id);
    await assertResidentOwnership(this.prisma, visitor.residentId, visitor.communityId, actor, PERMISSIONS.VISITOR_APPROVE);
    if (visitor.status === V.CHECKED_IN) {
      throw new ForbiddenException('A checked-in visitor cannot be cancelled — check them out instead');
    }
    await this.prisma.visitor.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actor.id } });
    return { id, cancelled: true };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async loadOrThrow(id: string) {
    const visitor = await this.prisma.visitor.findFirst({ where: { id, deletedAt: null } });
    if (!visitor) throw new NotFoundException('Visitor not found');
    await this.access.assert(visitor.communityId);
    return visitor;
  }

  private assertStatus(current: VisitorStatus, allowed: VisitorStatus[], action: string) {
    if (!allowed.includes(current)) {
      throw new BadRequestException(`A ${current.toLowerCase()} visit cannot be ${action}`);
    }
  }

  /** Plain residents only ever see their own visitors. */
  private async residentScope(query: QueryVisitorDto, actor: AuthenticatedUser): Promise<Prisma.VisitorWhereInput> {
    if (actor.permissions.includes(PERMISSIONS.VISITOR_APPROVE)) {
      return query.residentId ? { residentId: query.residentId } : {};
    }
    const ids = await myResidentIds(this.prisma, actor, query.communityId);
    return { residentId: { in: ids.length ? ids : ['__none__'] } };
  }

  private async assertCanView(visitor: { residentId: string; communityId: string }, actor: AuthenticatedUser) {
    if (actor.permissions.includes(PERMISSIONS.VISITOR_APPROVE)) return;
    const ids = await myResidentIds(this.prisma, actor, visitor.communityId);
    if (!ids.includes(visitor.residentId)) throw new ForbiddenException('Not your visitor');
  }

  private async uniquePassCode(): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const code = generatePassCode();
      const clash = await this.prisma.visitor.findUnique({ where: { passCode: code }, select: { id: true } });
      if (!clash) return code;
    }
    return generatePassCode(8); // vanishingly unlikely fallback
  }

  private publish(
    name: VisitorEvent['name'],
    visitor: { id: string; communityId: string; tenantId: string; visitorName: string; residentId: string },
    actor: AuthenticatedUser,
    extra?: Partial<VisitorEvent['data']>,
  ): void {
    const event = {
      name,
      tenantId: visitor.tenantId,
      communityId: visitor.communityId,
      actorId: actor.id,
      entityId: visitor.id,
      data: { visitorName: visitor.visitorName, residentId: visitor.residentId, ...extra },
    } satisfies Omit<VisitorEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
