import { BadRequestException } from '@nestjs/common';
import { GateEntryStatus, GateEntryType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { GateEntryService } from './gate-entry.service';

const ACTOR: AuthenticatedUser = {
  id: 'user-1', email: 'aisha@living.local', tenantId: 't-1', tenantIds: ['t-1'],
  roles: [], permissions: [],
};

const TZ = 'Asia/Kolkata';

/** Midday on the community's calendar day `offset` days from now. */
const day = (offset: number) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const [y, m, d] = today.split('-').map(Number);
  // 06:30Z is 12:00 in Asia/Kolkata — squarely inside the intended day there,
  // whatever the server's own timezone is.
  return new Date(Date.UTC(y!, m! - 1, d! + offset, 6, 30));
};

/**
 * A date-only form field arrives as LOCAL midnight, which in India is 18:30 UTC
 * the day before. The guard has to read the community's clock, or every
 * same-day invitation raised in the morning would be refused as "in the past".
 */
const todayLocalMidnightIST = () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0) - 5.5 * 60 * 60 * 1000);
};

function build() {
  const created: Record<string, unknown>[] = [];
  const timeline: Record<string, unknown>[] = [];
  const published: string[] = [];
  const prisma = {
    community: { findUnique: jest.fn().mockResolvedValue({ timezone: TZ }) },
    unit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit-1', unitNumber: 'A-101' }) },
    gate: { findFirst: jest.fn().mockResolvedValue({ id: 'gate-1' }) },
    gateEntry: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({ ...data, id: 'ge-1' });
      }),
    },
    gateEntryTimeline: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        timeline.push(data);
        return Promise.resolve({ id: 'tl-1' });
      }),
    },
    residentUnit: { findFirst: jest.fn().mockResolvedValue({ residentId: 'res-1' }) },
  };
  const svc = new GateEntryService(
    prisma as never,
    { assert: jest.fn().mockResolvedValue({ tenantId: 't-1' }) } as never,
    {} as never,
    { publish: jest.fn((e: { name: string }) => published.push(e.name)) } as never,
    { publish: jest.fn() } as never,
  );
  // findOne re-reads and signs the row; not what these tests are about.
  (svc as unknown as { findOne: unknown }).findOne = jest.fn((id: string) => Promise.resolve({ id }));
  return { svc, prisma, created, timeline, published };
}

const base = {
  unitId: 'unit-1',
  personName: 'Aditi Rao',
  entryType: GateEntryType.VISITOR,
};

/**
 * A gate pass cannot be back-dated, and a resident does not approve their own
 * invitation.
 *
 * Both reported from the field. The date guard lived only in the two forms'
 * `min` attributes, which a browser will happily submit past — a pass dated
 * last Tuesday reached the guard's screen. And an invitation was written
 * CREATED like any other arrival, so the engine asked the resident to approve
 * the visitor they had just invited, in the same session.
 */
describe('gate entry creation', () => {
  it('refuses an arrival expected before today', async () => {
    const { svc } = build();
    await expect(
      svc.create('c-1', { ...base, expectedArrival: day(-1) }, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts one expected later today', async () => {
    const { svc, created } = build();
    await svc.create('c-1', { ...base, expectedArrival: day(0) }, ACTOR);
    expect(created).toHaveLength(1);
  });

  it('accepts today sent as local midnight from a date field', async () => {
    // Reads as YESTERDAY in UTC. Comparing instants against the server's
    // midnight would refuse every same-day invitation raised in India.
    const { svc, created } = build();
    await svc.create('c-1', { ...base, expectedArrival: todayLocalMidnightIST() }, ACTOR);
    expect(created).toHaveLength(1);
  });

  it('accepts one expected in the future', async () => {
    const { svc, created } = build();
    await svc.create('c-1', { ...base, expectedArrival: day(30) }, ACTOR);
    expect(created).toHaveLength(1);
  });

  it('records an ordinary arrival CREATED, awaiting the resident', async () => {
    const { svc, created, published } = build();
    await svc.create('c-1', { ...base, entryType: GateEntryType.DELIVERY }, ACTOR);
    expect(created[0]!.status).toBe(GateEntryStatus.CREATED);
    expect(created[0]!.decidedAt).toBeUndefined();
    // The created event is what asks the resident to decide.
    expect(published).toContain('gate_entry.created');
  });

  it('records a pre-approved invitation APPROVED and never asks the resident', async () => {
    const { svc, created, timeline, published } = build();
    await svc.create('c-1', base, ACTOR, { preApproved: true });

    expect(created[0]!.status).toBe(GateEntryStatus.APPROVED);
    expect(created[0]!.decidedById).toBe(ACTOR.id);
    // No "someone is at your gate" event — that is the popup being fixed.
    expect(published).not.toContain('gate_entry.created');
    expect(published).toContain('gate_entry.approved');
    // The approval is still on the record, so the timeline explains itself.
    expect(timeline.map((t) => t.action)).toEqual(['CREATED', 'APPROVED']);
  });
});
