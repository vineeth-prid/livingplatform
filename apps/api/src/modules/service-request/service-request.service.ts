import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma, ServiceRequestStatus } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { myOccupancies } from '../community-ops/resident-access';
import { DomainEventName } from '../events/domain-events';
import type { PaymentEvent, ServiceRequestEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { participantWhere } from '../tenancy/participant-scope';
import { TicketService } from '../ticket/ticket.service';
import { StaffAutoAssignService } from '../staff/staff-auto-assign.service';
import { VendorAutoAssignService } from '../vendor/vendor-auto-assign.service';
import {
  AssignServiceRequestDto,
  ChangeServiceRequestStatusDto,
  CreateServiceRequestDto,
  CreateTicketFromRequestDto,
  LinkTicketDto,
  QueryServiceRequestDto,
  ScheduleServiceRequestDto,
  UpdateServiceRequestDto,
} from './dto/service-request.dto';
import { priceServiceRequest } from './service-pricing';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceRequestStatusService } from './service-request-status.service';

const SORTABLE = ['number', 'createdAt', 'priority', 'status', 'preferredDate'] as const;
const S = ServiceRequestStatus;

export function formatServiceRequestNumber(n: number): string {
  return `SRQ-${String(n).padStart(6, '0')}`;
}

@Injectable()
export class ServiceRequestService {
  private readonly logger = new Logger(ServiceRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly catalog: ServiceCatalogService,
    private readonly statusFlow: ServiceRequestStatusService,
    private readonly tickets: TicketService,
    private readonly events: DomainEventsService,
    private readonly autoAssign: VendorAutoAssignService,
    private readonly staffAutoAssign: StaffAutoAssignService,
  ) {}

  /**
   * `internal` carries fields that must NOT be settable over HTTP — currently
   * the package-purchase link. It is deliberately a separate parameter rather
   * than a DTO field so a resident cannot forge a redemption by posting one.
   */
  async create(
    communityId: string,
    dto: CreateServiceRequestDto,
    actor: AuthenticatedUser,
    internal?: { packagePurchaseId?: string },
  ) {
    const community = await this.access.assert(communityId);
    await this.assertUnitInCommunity(dto.unitId, communityId);
    await this.catalog.assertUsable(dto.serviceId, community.tenantId);
    if (dto.residentId) await this.assertResidentInCommunity(dto.residentId, communityId);

    // Only a resident booking for themselves pays up front. Staff raising a
    // request on someone's behalf settle it however the community does.
    let selfBooked = false;
    // Same gap as tickets: the resident app posts service/unit/title only, so a
    // resident's own request was stored with residentId NULL — unattributed,
    // and unreachable by any notification addressed to the person who made it.
    let residentId: string | undefined;
    if (internal || actor.permissions.includes(PERMISSIONS.SERVICE_UPDATE)) {
      residentId =
        dto.residentId
        ?? (await this.callerResidentId(communityId, actor))
        ?? (await this.primaryResidentOfUnit(dto.unitId));
    } else {
      // A resident books for the home they LIVE in (tenant or owner-occupier),
      // and the request — and what it costs — is always filed under themselves.
      // Without this, any unit id or residentId in the body was accepted.
      const home = (await myOccupancies(this.prisma, actor, communityId))
        .find((o) => o.unitId === dto.unitId);
      if (!home) {
        throw new ForbiddenException('You can only request services for the home you live in');
      }
      residentId = home.residentId;
      selfBooked = true;
    }

    // Price the request ONCE, here, and freeze the result onto the row. A later
    // catalogue edit must never rewrite what the resident was quoted.
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id: dto.serviceId },
      select: {
        basePrice: true,
        estimatedDurationMinutes: true,
        variants: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, price: true, durationMinutes: true, isActive: true },
        },
      },
    });
    const priced = priceServiceRequest({
      service,
      variants: service.variants,
      variantId: dto.variantId,
      quantity: dto.quantity,
    });

    // Pay first, then assign: a priced booking from the resident app waits,
    // unassigned, for its payment. Package redemptions are already paid for,
    // and a community with no service payment account keeps the old
    // book-and-assign flow rather than stranding every booking.
    const paymentRequired =
      selfBooked &&
      !internal?.packagePurchaseId &&
      Number(priced.totalPrice ?? 0) > 0 &&
      (await this.collectsServicePayments(communityId));

    const request = await this.prisma.serviceRequest.create({
      data: {
        paymentRequired,
        communityId,
        unitId: dto.unitId,
        serviceId: dto.serviceId,
        variantId: priced.variantId,
        quantity: priced.quantity,
        unitPrice: priced.unitPrice,
        totalPrice: priced.totalPrice,
        residentId,
        packagePurchaseId: internal?.packagePurchaseId ?? null,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        status: S.REQUESTED,
        requestedById: actor.id,
        preferredDate: dto.preferredDate,
        preferredTimeSlot: dto.preferredTimeSlot,
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.publish(DomainEventName.ServiceRequestCreated, request, actor);
    if (paymentRequired) return this.present(request);

    // Route it to a vendor immediately where one matches. Best-effort: the
    // request is already valid and saved, so a failure here leaves it
    // unassigned for a manager rather than failing the resident's booking.
    const assigned = await this.tryAutoAssign(request, community.tenantId, actor);
    return this.present(assigned ?? request);
  }

  /**
   * Auto-assign a new request to the least-loaded vendor covering this
   * community and offering this service. Returns null (never throws) when
   * nothing matches or anything goes wrong.
   */
  /**
   * A pay-first booking is assigned the moment its payment settles. Driven by
   * the `payment.succeeded` event, like package activation, so the payment
   * engine knows nothing about services. The conditional update makes the
   * checkout-callback / webhook race harmless: only one of them flips paidAt.
   */
  @OnEvent(DomainEventName.PaymentSucceeded, { async: true })
  async onPaymentSucceeded(event: PaymentEvent): Promise<void> {
    const id = event.data.serviceRequestId;
    if (!id) return;
    try {
      const { count } = await this.prisma.serviceRequest.updateMany({
        where: { id, paymentRequired: true, paidAt: null, deletedAt: null },
        data: { paidAt: new Date() },
      });
      if (!count) return;
      const request = await this.prisma.serviceRequest.findUniqueOrThrow({ where: { id } });
      if (request.status !== S.REQUESTED) return; // cancelled meanwhile — nothing to route
      // Not access.assert: a webhook settles with no signed-in caller to check.
      const community = await this.prisma.community.findUniqueOrThrow({
        where: { id: request.communityId },
        select: { tenantId: true },
      });
      // The payer is the actor; only id and tenant are read from it.
      const payer = { id: event.actorId, tenantId: community.tenantId } as AuthenticatedUser;
      await this.tryAutoAssign(request, community.tenantId, payer);
    } catch (err) {
      this.logger.error(`Could not route paid service request ${id}`, err as Error);
    }
  }

  /** Whether this community can take service payments online at all. */
  private async collectsServicePayments(communityId: string): Promise<boolean> {
    const config = await this.prisma.communityPaymentConfig.findFirst({
      where: { communityId, purpose: 'SERVICE', enabled: true, deletedAt: null },
      select: { id: true },
    });
    return !!config;
  }

  private async tryAutoAssign(
    request: { id: string; communityId: string; serviceId: string; status: ServiceRequestStatus },
    tenantId: string,
    actor: AuthenticatedUser,
  ) {
    try {
      const service = await this.prisma.service.findUnique({
        where: { id: request.serviceId },
        select: { key: true, name: true },
      });
      if (!service) return null;

      const categories = [service.key, service.name];

      const picked = await this.autoAssign.pick({
        tenantId,
        communityId: request.communityId,
        categories,
      });
      this.autoAssign.logOutcome('service-request', request.id, picked);

      // VENDORS FIRST here, unlike tickets, because a service is bought from
      // the vendor catalogue. But falling through to in-house staff matters: a
      // community whose housekeeping is done by its own people had NO staff
      // path at all on this route — only tickets tried staff — so a service
      // with no matching vendor was left unassigned even when somebody
      // in-house was allocated exactly that category.
      const staffPick = picked
        ? null
        : await this.staffAutoAssign.pick({ communityId: request.communityId, categories });
      if (staffPick) this.staffAutoAssign.logOutcome('service-request', request.id, staffPick);

      if (!picked && !staffPick) return null;

      const updated = await this.prisma.serviceRequest.update({
        where: { id: request.id },
        data: {
          // Staff XOR vendor — never both.
          assignedVendorId: picked?.vendorId ?? null,
          assignedStaffId: staffPick?.staffId ?? null,
          assignedAt: new Date(),
          autoAssigned: true,
          // assignedById stays null: no person made this call.
          status: request.status === S.REQUESTED ? S.ASSIGNED : request.status,
        },
      });
      this.publish(DomainEventName.ServiceAssigned, updated, actor);
      return updated;
    } catch (err) {
      this.logger.warn(
        `Auto-assignment failed for service request ${request.id}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async findMany(
    communityId: string,
    query: QueryServiceRequestDto,
    actor: AuthenticatedUser,
  ): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const filters: Prisma.ServiceRequestWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.residentId ? { residentId: query.residentId } : {}),
      ...(query.assignedStaffId ? { assignedStaffId: query.assignedStaffId } : {}),
      ...(query.assignedVendorId ? { assignedVendorId: query.assignedVendorId } : {}),
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
    const visible = await this.visibility(actor);
    const where: Prisma.ServiceRequestWhereInput = visible ? { AND: [filters, visible] } : filters;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          service: { select: { id: true, key: true, name: true, color: true } },
          unit: { select: { id: true, unitNumber: true } },
          resident: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);
    return paginate(items.map((r) => this.present(r)), total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, deletedAt: null, ...(await this.visibility(actor)) },
      include: {
        service: true,
        unit: { select: { id: true, unitNumber: true, blockId: true, floorId: true } },
        resident: { select: { id: true, firstName: true, lastName: true, mobile: true } },
        feedback: true,
      },
    });
    if (!request) throw new NotFoundException('Service request not found');
    await this.access.assert(request.communityId);
    return { ...this.present(request), assignee: await this.resolveAssignee(request) };
  }

  async update(id: string, dto: UpdateServiceRequestDto, actor: AuthenticatedUser) {
    const request = await this.loadOrThrow(id, actor);
    if (this.statusFlow.isTerminal(request.status)) {
      throw new BadRequestException(
        `A ${request.status.toLowerCase()} request cannot be edited`,
      );
    }
    if (dto.serviceId) {
      const community = await this.access.assert(request.communityId);
      await this.catalog.assertUsable(dto.serviceId, community.tenantId);
    }
    if (dto.residentId) {
      await this.assertResidentInCommunity(dto.residentId, request.communityId);
    }
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        serviceId: dto.serviceId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        residentId: dto.residentId,
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
    return this.present(updated);
  }

  async changeStatus(id: string, dto: ChangeServiceRequestStatusDto, actor: AuthenticatedUser) {
    const request = await this.loadOrThrow(id, actor);
    const from = request.status;
    const to = dto.status;
    this.statusFlow.assertTransition(from, to);
    this.assertStatusPermission(to, actor);

    const now = new Date();
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: to,
        actualStart:
          to === S.IN_PROGRESS && !request.actualStart ? now : undefined,
        actualEnd: to === S.COMPLETED && !request.actualEnd ? now : undefined,
        completedDate: to === S.COMPLETED ? now : undefined,
        notes: dto.note ? dto.note : undefined,
        updatedById: actor.id,
      },
    });

    const eventName = this.eventForStatus(to);
    if (eventName) this.publish(eventName, updated, actor, { fromStatus: from, status: to });
    return this.present(updated);
  }

  /**
   * A resident withdrawing their own booking. Allowed until the vendor or staff
   * member accepts the job; after that it is work in hand and goes through the
   * office. A paid booking needs a refund, which only management can issue.
   */
  async cancelMine(id: string, note: string | undefined, actor: AuthenticatedUser) {
    const request = await this.loadOrThrow(id, actor);
    const forMe =
      request.requestedById === actor.id ||
      (!!request.residentId &&
        !!(await this.prisma.resident.findFirst({
          where: { id: request.residentId, userId: actor.id, deletedAt: null },
          select: { id: true },
        })));
    if (!forMe) throw new ForbiddenException('You can only cancel your own bookings');
    if (request.status !== S.REQUESTED && request.status !== S.ASSIGNED) {
      throw new BadRequestException('This booking has already been accepted — contact management to cancel it');
    }
    if (request.paidAt) {
      throw new BadRequestException('This booking is paid — contact management to cancel it and arrange a refund');
    }
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: { status: S.CANCELLED, notes: note || undefined, updatedById: actor.id },
    });
    this.publish(DomainEventName.ServiceCancelled, updated, actor, { fromStatus: request.status, status: S.CANCELLED });
    return this.present(updated);
  }

  async assign(id: string, dto: AssignServiceRequestDto, actor: AuthenticatedUser) {
    const request = await this.loadOrThrow(id, actor);
    if (request.paymentRequired && !request.paidAt) {
      throw new BadRequestException("This booking is awaiting the resident's payment — it is assigned once paid");
    }
    const community = await this.access.assert(request.communityId);

    const hasStaff = !!dto.staffId;
    const hasVendor = !!dto.vendorId;
    if (hasStaff === hasVendor) {
      throw new BadRequestException('Assign to exactly one of staffId or vendorId');
    }
    if (dto.staffId) await this.assertStaffInCommunity(dto.staffId, request.communityId);
    if (dto.vendorId) await this.assertVendorCovers(dto.vendorId, community.tenantId, request.communityId);

    const wasAssigned = !!(request.assignedStaffId || request.assignedVendorId);
    const nextStatus = request.status === S.REQUESTED ? S.ASSIGNED : request.status;

    const updated = await this.prisma.serviceRequest.update({
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
    this.publish(DomainEventName.ServiceAssigned, updated, actor, {
      assigneeType: dto.staffId ? 'staff' : 'vendor',
      assigneeId: dto.staffId ?? dto.vendorId,
    });
    return this.present(updated);
  }

  async schedule(id: string, dto: ScheduleServiceRequestDto, actor: AuthenticatedUser) {
    await this.loadOrThrow(id, actor);
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        preferredDate: dto.preferredDate,
        preferredTimeSlot: dto.preferredTimeSlot,
        actualStart: dto.actualStart,
        actualEnd: dto.actualEnd,
        updatedById: actor.id,
      },
    });
    return this.present(updated);
  }

  // ── Ticket integration (loose coupling — Ticket Engine unchanged) ────────────

  async linkTicket(id: string, dto: LinkTicketDto, actor: AuthenticatedUser) {
    const request = await this.loadOrThrow(id, actor);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: dto.ticketId, communityId: request.communityId, deletedAt: null },
      select: { id: true },
    });
    if (!ticket) {
      throw new BadRequestException('Ticket not found in this community');
    }
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: { ticketId: dto.ticketId, updatedById: actor.id },
    });
    return this.present(updated);
  }

  /** Create a Ticket from this request (delegates to the Ticket Engine) and link it. */
  async createTicket(id: string, dto: CreateTicketFromRequestDto, actor: AuthenticatedUser) {
    const request = await this.loadOrThrow(id, actor);
    const ticket = await this.tickets.create(
      request.communityId,
      {
        unitId: request.unitId,
        categoryId: dto.categoryId,
        title: request.title,
        description: request.description,
        priority: dto.priority ?? request.priority,
        residentId: request.residentId ?? undefined,
        source: 'INTERNAL',
      },
      actor,
    );
    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: { ticketId: ticket.id, updatedById: actor.id },
    });
    return { serviceRequest: this.present(updated), ticket };
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.loadOrThrow(id);
    await this.prisma.serviceRequest.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async loadOrThrow(id: string, actor?: AuthenticatedUser) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, deletedAt: null, ...(actor ? await this.visibility(actor) : {}) },
    });
    if (!request) throw new NotFoundException('Service request not found');
    await this.access.assert(request.communityId);
    return request;
  }

  /** Rows the caller is a party to; null = the whole community (managers). */
  private visibility(actor: AuthenticatedUser): Promise<Prisma.ServiceRequestWhereInput | null> {
    return participantWhere<Prisma.ServiceRequestWhereInput>(
      this.prisma, actor, PERMISSIONS.SERVICE_ASSIGN, 'requestedById',
    );
  }

  private assertStatusPermission(to: ServiceRequestStatus, actor: AuthenticatedUser): void {
    const need =
      to === S.COMPLETED
        ? PERMISSIONS.SERVICE_COMPLETE
        : to === S.CANCELLED
          ? PERMISSIONS.SERVICE_CANCEL
          : PERMISSIONS.SERVICE_UPDATE;
    if (!actor.permissions.includes(need)) {
      throw new BadRequestException(`Missing required permission: ${need}`);
    }
  }

  private eventForStatus(to: ServiceRequestStatus) {
    switch (to) {
      case S.ACCEPTED:
        return DomainEventName.ServiceAccepted;
      case S.SCHEDULED:
        return DomainEventName.ServiceScheduled;
      case S.IN_PROGRESS:
        return DomainEventName.ServiceStarted;
      case S.COMPLETED:
        return DomainEventName.ServiceCompleted;
      case S.CANCELLED:
        return DomainEventName.ServiceCancelled;
      default:
        return null;
    }
  }

  private publish(
    name: ServiceRequestEvent['name'],
    request: { id: string; communityId: string; number: number },
    actor: AuthenticatedUser,
    extra?: Partial<ServiceRequestEvent['data']>,
  ): void {
    const event = {
      name,
      ...this.events.from(actor, request.communityId),
      entityId: request.id,
      data: { requestNumber: formatServiceRequestNumber(request.number), ...extra },
    } satisfies Omit<ServiceRequestEvent, 'occurredAt'>;
    this.events.publish(event);
  }

  private async resolveAssignee(request: {
    assignedStaffId: string | null;
    assignedVendorId: string | null;
  }) {
    if (request.assignedStaffId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: request.assignedStaffId },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      return staff ? { type: 'staff' as const, ...staff } : null;
    }
    if (request.assignedVendorId) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: request.assignedVendorId },
        select: { id: true, name: true, category: true },
      });
      return vendor ? { type: 'vendor' as const, ...vendor } : null;
    }
    return null;
  }

  private searchWhere(search: string): Prisma.ServiceRequestWhereInput {
    const contains = { contains: search, mode: 'insensitive' as const };
    const digits = search.replace(/\D/g, '');
    const or: Prisma.ServiceRequestWhereInput[] = [
      { title: contains },
      { unit: { unitNumber: contains } },
      { resident: { OR: [{ firstName: contains }, { lastName: contains }] } },
      { service: { name: contains } },
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
   * The caller's own resident record in this community, when they have one.
   * Undefined for staff and admins raising a request on someone's behalf.
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

  /** The unit's occupant, for a request an admin raised on someone's behalf. */
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
      where: { id: vendorId, tenantId, deletedAt: null, communityIds: { has: communityId } },
      select: { id: true },
    });
    if (!vendor) throw new BadRequestException('Vendor does not cover this community');
  }

  private present<T extends { number: number }>(request: T) {
    return { ...request, requestNumber: formatServiceRequestNumber(request.number) };
  }
}
