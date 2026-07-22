import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceRequestStatus } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import type { ServiceRequestEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { TicketService } from '../ticket/ticket.service';
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
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceRequestStatusService } from './service-request-status.service';

const SORTABLE = ['number', 'createdAt', 'priority', 'status', 'preferredDate'] as const;
const S = ServiceRequestStatus;

export function formatServiceRequestNumber(n: number): string {
  return `SRQ-${String(n).padStart(6, '0')}`;
}

@Injectable()
export class ServiceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly catalog: ServiceCatalogService,
    private readonly statusFlow: ServiceRequestStatusService,
    private readonly tickets: TicketService,
    private readonly events: DomainEventsService,
  ) {}

  async create(communityId: string, dto: CreateServiceRequestDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(communityId);
    await this.assertUnitInCommunity(dto.unitId, communityId);
    await this.catalog.assertUsable(dto.serviceId, community.tenantId);
    if (dto.residentId) await this.assertResidentInCommunity(dto.residentId, communityId);

    const request = await this.prisma.serviceRequest.create({
      data: {
        communityId,
        unitId: dto.unitId,
        serviceId: dto.serviceId,
        residentId: dto.residentId,
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
    return this.present(request);
  }

  async findMany(communityId: string, query: QueryServiceRequestDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.ServiceRequestWhereInput = {
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

  async findOne(id: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, deletedAt: null },
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
    const request = await this.loadOrThrow(id);
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
    const request = await this.loadOrThrow(id);
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

  async assign(id: string, dto: AssignServiceRequestDto, actor: AuthenticatedUser) {
    const request = await this.loadOrThrow(id);
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
    await this.loadOrThrow(id);
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
    const request = await this.loadOrThrow(id);
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
    const request = await this.loadOrThrow(id);
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

  private async loadOrThrow(id: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, deletedAt: null },
    });
    if (!request) throw new NotFoundException('Service request not found');
    await this.access.assert(request.communityId);
    return request;
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
