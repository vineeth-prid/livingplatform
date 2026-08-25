import { BadRequestException, ConflictException } from '@nestjs/common';

import { BookingService } from './booking.service';

/**
 * Amenity capacity is a HEADCOUNT.
 *
 * "Swimming Pool, 30" means thirty people, but the engine counted BOOKINGS —
 * so the clubhouse for fifty accepted fifty separate parties, and a resident
 * had no field to say how many were coming in the first place.
 */
const AMENITY = {
  id: 'am-1', isBookable: true, status: 'ACTIVE', capacity: 30,
  operatingHours: null, bookingWindowDays: 30, maxBookingMinutes: null,
  community: { timezone: 'Asia/Kolkata' },
};

const ACTOR = { id: 'u-1', email: 'r@x', permissions: [] } as never;

const slot = () => {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(12, 0, 0, 0);
  return { startTime: start, endTime: end };
};

function build(opts: { capacity?: number | null; taken?: number; parties?: number } = {}) {
  const created: Record<string, unknown>[] = [];
  const prisma = {
    amenity: {
      findFirst: jest.fn().mockResolvedValue({
        ...AMENITY,
        capacity: opts.capacity === undefined ? AMENITY.capacity : opts.capacity,
      }),
    },
    amenityBooking: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { headCount: opts.taken ?? 0 },
        _count: { _all: opts.parties ?? (opts.taken ? 1 : 0) },
      }),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({ ...data, id: 'bk-1' });
      }),
    },
    // The booking is the caller's own — ownership is matched on the linked user.
    resident: { findFirst: jest.fn().mockResolvedValue({ id: 'res-1', userId: 'u-1' }) },
    residentUnit: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const svc = new BookingService(
    prisma as never,
    { assert: jest.fn().mockResolvedValue({ tenantId: 't-1' }) } as never,
    { publish: jest.fn() } as never,
  );
  return { svc, created };
}

const dto = (headCount?: number) => ({
  communityId: 'c-1', amenityId: 'am-1', residentId: 'res-1', ...slot(),
  ...(headCount === undefined ? {} : { headCount }),
});

describe('amenity booking capacity', () => {
  it('stores the head count the resident entered', async () => {
    const { svc, created } = build();
    await svc.create(dto(4), ACTOR);
    expect(created[0]!.headCount).toBe(4);
  });

  it('defaults to one person when the field is omitted', async () => {
    const { svc, created } = build();
    await svc.create(dto(), ACTOR);
    expect(created[0]!.headCount).toBe(1);
  });

  it('lets several parties share a slot while places remain', async () => {
    // 22 already booked, 8 more asked for, capacity 30 — this is the case the
    // old rule rejected once a single booking existed, and accepted forever
    // once capacity was read as a booking count.
    const { svc, created } = build({ taken: 22, parties: 5 });
    await svc.create(dto(8), ACTOR);
    expect(created[0]!.headCount).toBe(8);
  });

  it('refuses the party that would exceed capacity', async () => {
    const { svc } = build({ taken: 22, parties: 5 });
    await expect(svc.create(dto(9), ACTOR)).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a party larger than the amenity itself', async () => {
    const { svc } = build({ taken: 0 });
    await expect(svc.create(dto(31), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats an amenity with no capacity as exclusive, as before', async () => {
    const { svc } = build({ capacity: null, taken: 1, parties: 1 });
    await expect(svc.create(dto(1), ACTOR)).rejects.toBeInstanceOf(ConflictException);
  });
});
