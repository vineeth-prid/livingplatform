import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type BookingEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  assertFutureWithinWindow, assertValidTimeRange, assertWithinOperatingHours, type OperatingHours,
} from './booking.util';
import { CancelBookingDto, CreateBookingDto, QueryBookingDto } from './dto/booking.dto';
import { assertResidentOwnership, myResidentIds } from './resident-access';

const SORTABLE = ['bookingDate', 'amenityId', 'startTime', 'createdAt'] as const;
const B = BookingStatus;
const ACTIVE: BookingStatus[] = [B.PENDING, B.CONFIRMED];

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async create(dto: CreateBookingDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(dto.communityId);
    await assertResidentOwnership(this.prisma, dto.residentId, dto.communityId, actor, PERMISSIONS.BOOKING_UPDATE);

    const amenity = await this.prisma.amenity.findFirst({
      where: { id: dto.amenityId, communityId: dto.communityId, deletedAt: null },
      select: { id: true, isBookable: true, status: true, capacity: true, operatingHours: true, bookingWindowDays: true },
    });
    if (!amenity) throw new BadRequestException('Amenity does not belong to this community');
    if (amenity.status !== 'ACTIVE' || !amenity.isBookable) {
      throw new BadRequestException('This amenity is not available for booking');
    }

    assertValidTimeRange(dto.startTime, dto.endTime);
    assertFutureWithinWindow(dto.startTime, amenity.bookingWindowDays, new Date());
    assertWithinOperatingHours(dto.startTime, dto.endTime, amenity.operatingHours as unknown as OperatingHours | null);

    // Capacity: how many active bookings already overlap this slot?
    const overlapping = await this.prisma.amenityBooking.count({
      where: {
        amenityId: dto.amenityId,
        deletedAt: null,
        status: { in: ACTIVE },
        startTime: { lt: dto.endTime },
        endTime: { gt: dto.startTime },
      },
    });
    if (overlapping >= (amenity.capacity ?? 1)) {
      throw new ConflictException('This slot is fully booked');
    }

    const booking = await this.prisma.amenityBooking.create({
      data: {
        tenantId: community.tenantId,
        communityId: dto.communityId,
        amenityId: dto.amenityId,
        residentId: dto.residentId,
        bookingDate: startOfDay(dto.startTime),
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: B.CONFIRMED,
        remarks: dto.remarks,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.publish(DomainEventName.BookingCreated, booking, actor, { status: B.CONFIRMED });
    return booking;
  }

  async findMany(query: QueryBookingDto, actor: AuthenticatedUser): Promise<Paginated<unknown>> {
    await this.access.assert(query.communityId);
    const where: Prisma.AmenityBookingWhereInput = {
      communityId: query.communityId,
      deletedAt: null,
      ...(await this.residentScope(query, actor)),
      ...(query.amenityId ? { amenityId: query.amenityId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? { bookingDate: { ...(query.dateFrom ? { gte: startOfDay(query.dateFrom) } : {}), ...(query.dateTo ? { lte: startOfDay(query.dateTo) } : {}) } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.amenityBooking.findMany({
        where,
        include: {
          amenity: { select: { id: true, name: true, location: true } },
          resident: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: resolveSort(query, SORTABLE, 'bookingDate'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.amenityBooking.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const booking = await this.loadOrThrow(id);
    if (!actor.permissions.includes(PERMISSIONS.BOOKING_UPDATE)) {
      const ids = await myResidentIds(this.prisma, actor, booking.communityId);
      if (!ids.includes(booking.residentId)) throw new ForbiddenException('Not your booking');
    }
    return booking;
  }

  async cancel(id: string, dto: CancelBookingDto, actor: AuthenticatedUser) {
    const booking = await this.loadOrThrow(id);
    await assertResidentOwnership(this.prisma, booking.residentId, booking.communityId, actor, PERMISSIONS.BOOKING_UPDATE);
    if (!ACTIVE.includes(booking.status)) {
      throw new BadRequestException(`A ${booking.status.toLowerCase()} booking cannot be cancelled`);
    }
    const updated = await this.prisma.amenityBooking.update({
      where: { id },
      data: { status: B.CANCELLED, remarks: dto.reason ?? booking.remarks, updatedById: actor.id },
    });
    this.publish(DomainEventName.BookingCancelled, updated, actor, { status: B.CANCELLED });
    return updated;
  }

  /** Manager status/remarks update (e.g. mark COMPLETED). Not for residents. */
  async update(id: string, input: { status?: BookingStatus; remarks?: string }, actor: AuthenticatedUser) {
    const booking = await this.loadOrThrow(id);
    if (booking.status === B.CANCELLED || booking.status === B.COMPLETED) {
      throw new BadRequestException('A closed booking cannot be updated');
    }
    return this.prisma.amenityBooking.update({
      where: { id },
      data: { status: input.status, remarks: input.remarks, updatedById: actor.id },
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async loadOrThrow(id: string) {
    const booking = await this.prisma.amenityBooking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.access.assert(booking.communityId);
    return booking;
  }

  private async residentScope(query: QueryBookingDto, actor: AuthenticatedUser): Promise<Prisma.AmenityBookingWhereInput> {
    if (actor.permissions.includes(PERMISSIONS.BOOKING_UPDATE)) {
      return query.residentId ? { residentId: query.residentId } : {};
    }
    const ids = await myResidentIds(this.prisma, actor, query.communityId);
    return { residentId: { in: ids.length ? ids : ['__none__'] } };
  }

  private publish(
    name: BookingEvent['name'],
    booking: { id: string; communityId: string; tenantId: string; amenityId: string; residentId: string },
    actor: AuthenticatedUser,
    extra?: Partial<BookingEvent['data']>,
  ): void {
    const event = {
      name,
      tenantId: booking.tenantId,
      communityId: booking.communityId,
      actorId: actor.id,
      entityId: booking.id,
      data: { amenityId: booking.amenityId, residentId: booking.residentId, ...extra },
    } satisfies Omit<BookingEvent, 'occurredAt'>;
    this.events.publish(event);
  }
}
