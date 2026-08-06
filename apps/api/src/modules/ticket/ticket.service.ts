import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TicketEventType, TicketStatus } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { StaffAutoAssignService } from '../staff/staff-auto-assign.service';
import { VendorAutoAssignService } from '../vendor/vendor-auto-assign.service';
import {
  AssignTicketDto,
  ChangeTicketStatusDto,
  CreateTicketDto,
  QueryTicketDto,
  UpdateTicketDto,
} from './dto/ticket.dto';
import { TicketCategoryService } from './ticket-category.service';
import { TicketStatusService } from './ticket-status.service';
import { TicketTimelineService } from './ticket-timeline.service';

const SORTABLE = ['number', 'createdAt', 'priority', 'status', 'dueDate'] as const;

export function formatTicketNumber(n: number): string {
  return `TKT-${String(n).padStart(6, '0')}`;
}

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly categories: TicketCategoryService,
    private readonly statusFlow: TicketStatusService,
    private readonly timeline: TicketTimelineService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
    private readonly autoAssign: VendorAutoAssignService,
    private readonly staffAutoAssign: StaffAutoAssignService,
  ) {}

  async create(communityId: string, dto: CreateTicketDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(communityId);
    await this.assertUnitInCommunity(dto.unitId, communityId);
    await this.categories.assertUsable(dto.categoryId, community.tenantId);
    if (dto.residentId) await this.assertResidentInCommunity(dto.residentId, communityId);

    // A resident raising their own complaint does not send (and must not have
    // to know) their resident id — the app posts unit/category/title/body only.
    // Without this the ticket was stored with residentId NULL, so it belonged
    // to nobody: no notification could address the person who raised it, and
    // an admin filtering by resident never saw it. The resident app hid the gap
    // by filtering its own list on reportedById instead.
    const residentId =
      dto.residentId
      ?? (await this.callerResidentId(communityId, actor))
      ?? (await this.primaryResidentOfUnit(dto.unitId));

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          communityId,
          unitId: dto.unitId,
          categoryId: dto.categoryId,
          residentId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? 'MEDIUM',
          status: 'OPEN',
          source: dto.source ?? 'ADMIN_PORTAL',
          reportedById: actor.id,
          dueDate: dto.dueDate,
          notes: dto.notes,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      await this.timeline.record({
        ticketId: created.id,
        type: TicketEventType.CREATED,
        actorId: actor.id,
        tx,
      });
      return created;
    });

    this.events.publish({
      name: DomainEventName.TicketCreated,
      ...this.events.from(actor, communityId),
      entityId: ticket.id,
      data: { ticketNumber: formatTicketNumber(ticket.number) },
    });

    // Try to route it to a vendor straight away. Best-effort by design: the
    // ticket already exists and is valid, so a failure here must never surface
    // to the reporter — it just stays unassigned for a manager to pick up.
    const assigned = await this.tryAutoAssign(ticket, community.tenantId, actor);
    return this.present(assigned ?? ticket);
  }

  /**
   * Auto-assign a freshly created ticket to the least-loaded match.
   *
   * IN-HOUSE STAFF FIRST, then vendors. A community that has allocated
   * categories to its own people expects those people to get the work; falling
   * through to a vendor only when nobody in-house covers the category preserves
   * the previous behaviour for communities that have not set staff categories
   * up yet (the column defaults to empty, so they match nothing and go straight
   * to the vendor path).
   *
   * Returns the updated row, or null when nothing matched or anything went
   * wrong. Never throws — a failed lookup loses the assignment, never the ticket.
   */
  private async tryAutoAssign(
    ticket: { id: string; communityId: string; categoryId: string; status: TicketStatus },
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    try {
      const category = await this.prisma.ticketCategory.findUnique({
        where: { id: ticket.categoryId },
        select: { key: true, name: true },
      });
      if (!category) return null;

      const categories = [category.key, category.name];

      const staffPick = await this.staffAutoAssign.pick({
        communityId: ticket.communityId,
        categories,
      });
      this.staffAutoAssign.logOutcome('ticket', ticket.id, staffPick);
      if (staffPick) {
        return this.applyAutoAssignment(ticket, actor, {
          assignedStaffId: staffPick.staffId,
          timelineMetadata: {
            staffId: staffPick.staffId,
            auto: true,
            workload: staffPick.openWorkload,
          },
        });
      }

      const picked = await this.autoAssign.pick({
        tenantId,
        communityId: ticket.communityId,
        categories,
      });
      this.autoAssign.logOutcome('ticket', ticket.id, picked);
      if (!picked) return null;

      const updated = await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedVendorId: picked.vendorId,
          assignedAt: new Date(),
          autoAssigned: true,
          // assignedById stays null: no person made this call.
          status: ticket.status === TicketStatus.OPEN ? TicketStatus.ASSIGNED : ticket.status,
        },
      });
      await this.timeline.record({
        ticketId: ticket.id,
        type: TicketEventType.ASSIGNED,
        actorId: actor.id,
        metadata: { vendorId: picked.vendorId, auto: true, workload: picked.openWorkload },
      });
      this.events.publish({
        name: DomainEventName.TicketAssigned,
        ...this.events.from(actor, ticket.communityId),
        entityId: ticket.id,
        data: { ticketNumber: formatTicketNumber(updated.number), assigneeType: 'vendor', auto: true },
      });
      return updated;
    } catch (err) {
      this.logger.warn(`Auto-assignment failed for ticket ${ticket.id}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Persist an auto-assignment to a STAFF member, with its timeline row and
   * domain event. Assignment is Staff XOR Vendor, so the vendor column is
   * explicitly cleared rather than left to chance.
   */
  private async applyAutoAssignment(
    ticket: { id: string; communityId: string; status: TicketStatus },
    actor: AuthenticatedUser,
    input: { assignedStaffId: string; timelineMetadata: Prisma.InputJsonValue },
  ) {
    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedStaffId: input.assignedStaffId,
        assignedVendorId: null,
        assignedAt: new Date(),
        autoAssigned: true,
        // assignedById stays null: no person made this call.
        status: ticket.status === TicketStatus.OPEN ? TicketStatus.ASSIGNED : ticket.status,
      },
    });
    await this.timeline.record({
      ticketId: ticket.id,
      type: TicketEventType.ASSIGNED,
      actorId: actor.id,
      metadata: input.timelineMetadata,
    });
    this.events.publish({
      name: DomainEventName.TicketAssigned,
      ...this.events.from(actor, ticket.communityId),
      entityId: ticket.id,
      data: {
        ticketNumber: formatTicketNumber(updated.number),
        assigneeType: 'staff',
        auto: true,
      },
    });
    return updated;
  }

  async findMany(communityId: string, query: QueryTicketDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.TicketWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.residentId ? { residentId: query.residentId } : {}),
      ...(query.assignedStaffId ? { assignedStaffId: query.assignedStaffId } : {}),
      ...(query.assignedVendorId ? { assignedVendorId: query.assignedVendorId } : {}),
      ...(query.blockId || query.floorId
        ? {
            unit: {
              ...(query.blockId ? { blockId: query.blockId } : {}),
              ...(query.floorId ? { floorId: query.floorId } : {}),
            },
          }
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
      this.prisma.ticket.findMany({
        where,
        include: {
          category: { select: { id: true, key: true, name: true, color: true } },
          unit: { select: { id: true, unitNumber: true, blockId: true, floorId: true } },
          resident: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return paginate(items.map((t) => this.present(t)), total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        unit: { select: { id: true, unitNumber: true, blockId: true, floorId: true } },
        resident: { select: { id: true, firstName: true, lastName: true, mobile: true } },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
        attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    await this.access.assert(ticket.communityId);

    const canSeeInternal = actor.permissions.includes(PERMISSIONS.TICKET_UPDATE);
    return {
      ...this.present(ticket),
      assignee: await this.resolveAssignee(ticket),
      comments: ticket.comments.filter((c) => canSeeInternal || !c.isInternal),
      attachments: ticket.attachments.map((a) => ({
        ...a,
        downloadUrl: this.storage.resolveUrl(a.storageKey),
      })),
    };
  }

  async update(id: string, dto: UpdateTicketDto, actor: AuthenticatedUser) {
    const ticket = await this.loadOrThrow(id);
    this.assertEditable(ticket, actor);

    if (dto.categoryId) {
      const community = await this.access.assert(ticket.communityId);
      await this.categories.assertUsable(dto.categoryId, community.tenantId);
    }
    if (dto.residentId) {
      await this.assertResidentInCommunity(dto.residentId, ticket.communityId);
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        residentId: dto.residentId,
        dueDate: dto.dueDate,
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
    await this.timeline.record({
      ticketId: id,
      type: TicketEventType.UPDATED,
      actorId: actor.id,
    });
    return this.present(updated);
  }

  async changeStatus(id: string, dto: ChangeTicketStatusDto, actor: AuthenticatedUser) {
    const ticket = await this.loadOrThrow(id);
    const from = ticket.status;
    const to = dto.status;
    this.statusFlow.assertTransition(from, to);
    this.assertStatusPermission(to, actor);
    await this.assertNotAwaitingApproval(id, from, to);
    await this.assertEvidence(id, to);

    const isReopen =
      to === TicketStatus.IN_PROGRESS &&
      (from === TicketStatus.RESOLVED || from === TicketStatus.CLOSED);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: to,
        resolvedDate: to === TicketStatus.RESOLVED ? new Date() : isReopen ? null : undefined,
        closedDate: to === TicketStatus.CLOSED ? new Date() : isReopen ? null : undefined,
        updatedById: actor.id,
      },
    });
    await this.timeline.record({
      ticketId: id,
      type: this.eventTypeForStatus(to, isReopen),
      actorId: actor.id,
      reference: `${from}->${to}`,
      metadata: dto.note ? { note: dto.note } : undefined,
    });

    const base = { ...this.events.from(actor, ticket.communityId), entityId: id };
    const num = formatTicketNumber(ticket.number);
    this.events.publish({
      name: DomainEventName.TicketStatusChanged,
      ...base,
      data: { ticketNumber: num, status: to, fromStatus: from },
    });
    if (to === TicketStatus.RESOLVED) {
      this.events.publish({
        name: DomainEventName.TicketResolved,
        ...base,
        data: { ticketNumber: num },
      });
    }
    if (to === TicketStatus.CLOSED) {
      this.events.publish({
        name: DomainEventName.TicketClosed,
        ...base,
        data: { ticketNumber: num },
      });
    }
    return this.present(updated);
  }

  async assign(id: string, dto: AssignTicketDto, actor: AuthenticatedUser) {
    const ticket = await this.loadOrThrow(id);
    const community = await this.access.assert(ticket.communityId);

    // Exactly one of staff / vendor (never both, never neither).
    const hasStaff = !!dto.staffId;
    const hasVendor = !!dto.vendorId;
    if (hasStaff === hasVendor) {
      throw new BadRequestException(
        'Assign to exactly one of staffId or vendorId',
      );
    }
    if (dto.staffId) await this.assertStaffInCommunity(dto.staffId, ticket.communityId);
    if (dto.vendorId) await this.assertVendorCovers(dto.vendorId, community.tenantId, ticket.communityId);

    const wasAssigned = !!(ticket.assignedStaffId || ticket.assignedVendorId);
    const nextStatus =
      ticket.status === TicketStatus.OPEN ? TicketStatus.ASSIGNED : ticket.status;

    const updated = await this.prisma.ticket.update({
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
      ticketId: id,
      type: wasAssigned ? TicketEventType.REASSIGNED : TicketEventType.ASSIGNED,
      actorId: actor.id,
      reference: dto.staffId ?? dto.vendorId,
      metadata: {
        assigneeType: dto.staffId ? 'staff' : 'vendor',
        ...(dto.note ? { note: dto.note } : {}),
      },
    });
    this.events.publish({
      name: DomainEventName.TicketAssigned,
      ...this.events.from(actor, ticket.communityId),
      entityId: id,
      data: {
        ticketNumber: formatTicketNumber(ticket.number),
        assigneeType: dto.staffId ? 'staff' : 'vendor',
        assigneeId: dto.staffId ?? dto.vendorId,
      },
    });
    return this.present(updated);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.loadOrThrow(id);
    await this.prisma.ticket.update({
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
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, deletedAt: null },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    await this.access.assert(ticket.communityId);
    return ticket;
  }

  /** Closed tickets can only be edited by users holding ticket:close. */
  private assertEditable(
    ticket: { status: TicketStatus },
    actor: AuthenticatedUser,
  ): void {
    if (
      ticket.status === TicketStatus.CLOSED &&
      !actor.permissions.includes(PERMISSIONS.TICKET_CLOSE)
    ) {
      throw new ForbiddenException('Closed tickets can only be edited by privileged users');
    }
  }

  private assertStatusPermission(to: TicketStatus, actor: AuthenticatedUser): void {
    const need =
      to === TicketStatus.RESOLVED
        ? PERMISSIONS.TICKET_RESOLVE
        : to === TicketStatus.CLOSED
          ? PERMISSIONS.TICKET_CLOSE
          : PERMISSIONS.TICKET_UPDATE;
    if (!actor.permissions.includes(need)) {
      throw new ForbiddenException(`Missing required permission: ${need}`);
    }
  }

  private eventTypeForStatus(to: TicketStatus, isReopen: boolean): TicketEventType {
    if (isReopen) return TicketEventType.REOPENED;
    switch (to) {
      case TicketStatus.RESOLVED:
        return TicketEventType.RESOLVED;
      case TicketStatus.CLOSED:
        return TicketEventType.CLOSED;
      case TicketStatus.CANCELLED:
        return TicketEventType.CANCELLED;
      default:
        return TicketEventType.STATUS_CHANGED;
    }
  }

  private async resolveAssignee(ticket: {
    assignedStaffId: string | null;
    assignedVendorId: string | null;
  }) {
    if (ticket.assignedStaffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: ticket.assignedStaffId },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      return staff ? { type: 'staff' as const, ...staff } : null;
    }
    if (ticket.assignedVendorId) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: ticket.assignedVendorId },
        select: { id: true, name: true, category: true },
      });
      return vendor ? { type: 'vendor' as const, ...vendor } : null;
    }
    return null;
  }

  private searchWhere(search: string): Prisma.TicketWhereInput {
    const contains = { contains: search, mode: 'insensitive' as const };
    const digits = search.replace(/\D/g, '');
    const or: Prisma.TicketWhereInput[] = [
      { title: contains },
      { unit: { unitNumber: contains } },
      { resident: { OR: [{ firstName: contains }, { lastName: contains }] } },
      { category: { name: contains } },
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

  /**
   * A ticket parked on a spending decision cannot be resumed by the person who
   * asked for that decision.
   *
   * Moving it to ON_HOLD was never enough on its own: ON_HOLD → IN_PROGRESS is
   * an ordinary transition, so "Resume" put the staff member straight back to
   * work on the job they had just told the resident was paused. The manager's
   * answer is what releases it, and approve/reject already do exactly that.
   */
  private async assertNotAwaitingApproval(
    ticketId: string,
    from: TicketStatus,
    to: TicketStatus,
  ): Promise<void> {
    if (from !== TicketStatus.ON_HOLD || to !== TicketStatus.IN_PROGRESS) return;

    const pending = await this.prisma.workOrder.findFirst({
      where: {
        originType: 'TICKET',
        originId: ticketId,
        status: 'PENDING_APPROVAL',
        deletedAt: null,
      },
      select: { number: true },
    });
    if (!pending) return;

    throw new BadRequestException(
      `Work order WO-${String(pending.number).padStart(6, '0')} is waiting for approval. ` +
        'This job resumes on its own once a manager approves or rejects it.',
    );
  }

  /**
   * Site evidence, same rule as work orders: a BEFORE photo to start, an AFTER
   * photo to resolve.
   *
   * Gating only work orders was a real gap — most staff work is a TICKET, and
   * that path had no photo requirement at all, so the obligation existed
   * everywhere except where the work actually happens.
   */
  private async assertEvidence(ticketId: string, to: TicketStatus): Promise<void> {
    const stage =
      to === TicketStatus.IN_PROGRESS ? 'BEFORE' : to === TicketStatus.RESOLVED ? 'AFTER' : null;
    if (!stage) return;

    const count = await this.prisma.ticketAttachment.count({
      where: { ticketId, deletedAt: null, stage },
    });
    if (count > 0) return;

    throw new BadRequestException(
      stage === 'BEFORE'
        ? 'Take a “before” photo of the site before starting work.'
        : 'Take an “after” photo showing the finished work before resolving this.',
    );
  }

  /**
   * The caller's own resident record in this community, when they have one.
   *
   * Returns undefined for staff and admins — they are raising it on someone
   * else's behalf, and an unattributed ticket is the correct outcome there
   * rather than one falsely linked to the operator.
   */
  private async callerResidentId(
    communityId: string,
    actor: AuthenticatedUser,
  ): Promise<string | undefined> {
    const resident = await this.prisma.resident.findFirst({
      where: { communityId, userId: actor.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return resident?.id;
  }

  /**
   * The unit's occupant, for a ticket an ADMIN raised on someone's behalf.
   *
   * The admin portal asks for a unit, never a resident — so without this the
   * ticket is unattributed and the person it was raised for is never told about
   * it. PRIMARY first, because a unit can hold an owner, a tenant and family
   * members, and the primary occupant is who the community deals with.
   */
  private async primaryResidentOfUnit(unitId: string): Promise<string | undefined> {
    const assignment = await this.prisma.residentUnit.findFirst({
      where: { unitId, status: 'ACTIVE', resident: { deletedAt: null } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { residentId: true },
    });
    return assignment?.residentId;
  }

  private async assertResidentInCommunity(residentId: string, communityId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!resident) throw new BadRequestException('Resident does not belong to this community');
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
      where: {
        id: vendorId,
        tenantId,
        deletedAt: null,
        communityIds: { has: communityId },
      },
      select: { id: true },
    });
    if (!vendor) {
      throw new BadRequestException('Vendor does not cover this community');
    }
  }

  private present<T extends { number: number }>(ticket: T) {
    return { ...ticket, ticketNumber: formatTicketNumber(ticket.number) };
  }
}
