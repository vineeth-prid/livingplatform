import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GateEntryStatus, GateEntryType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { DomainEventsService } from '../events/domain-events.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeService } from '../realtime/realtime.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import type { StorageService } from '../storage/storage.service';
import type { CommunityAccessService } from '../tenancy/community-access.service';
import { GateEntryService } from './gate-entry.service';

const ENTRY: {
  id: string;
  tenantId: string;
  communityId: string;
  entryNumber: string;
  entryType: GateEntryType;
  status: GateEntryStatus;
  unitId: string;
  residentId: string | null;
  personName: string;
  vendorName: string | null;
  photoKey: string | null;
  viewedAt: Date | null;
  decisionNote: string | null;
} = {
  id: 'ge-1',
  tenantId: 't-1',
  communityId: 'c-1',
  entryNumber: 'GE-000001',
  entryType: GateEntryType.DELIVERY,
  status: GateEntryStatus.NOTIFIED,
  unitId: 'unit-1',
  residentId: 'res-1',
  personName: 'Ramesh',
  vendorName: 'Swiggy',
  photoKey: null,
  viewedAt: null,
  decisionNote: null,
};

/** A resident with no gate permissions at all — the normal case. */
const RESIDENT: AuthenticatedUser = {
  id: 'user-res-1',
  email: 'aisha@living.local',
  tenantId: 't-1',
  roles: [],
  permissions: [],
};

/** A manager who may act on any entry in the community. */
const MANAGER: AuthenticatedUser = {
  ...RESIDENT,
  id: 'user-fm',
  email: 'fm@living.local',
  permissions: [PERMISSIONS.GATE_ENTRY_UPDATE, PERMISSIONS.GATE_ENTRY_VIEW],
};

function makeService(overrides: {
  entry?: Partial<typeof ENTRY>;
  /** Resident rows the caller's user id maps to. */
  myResidents?: { id: string }[];
} = {}) {
  const entry = { ...ENTRY, ...overrides.entry };
  const updated = jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...entry, ...args.data }),
  );

  const prisma = {
    gateEntry: {
      findFirst: jest.fn().mockResolvedValue(entry),
      findUnique: jest.fn().mockResolvedValue(entry),
      update: updated,
      count: jest.fn().mockResolvedValue(0),
    },
    gateEntryTimeline: { create: jest.fn().mockResolvedValue({}) },
    resident: {
      findMany: jest.fn().mockResolvedValue(overrides.myResidents ?? [{ id: 'res-1' }]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    unit: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), findUnique: jest.fn() },
  } as unknown as PrismaService;

  const access = { assert: jest.fn().mockResolvedValue({ id: 'c-1', tenantId: 't-1' }) } as unknown as CommunityAccessService;
  const storage = { signDownload: jest.fn(), buildKey: jest.fn(), signUpload: jest.fn() } as unknown as StorageService;
  const events = { publish: jest.fn() } as unknown as DomainEventsService;
  const realtime = { publish: jest.fn() } as unknown as RealtimeService;

  const service = new GateEntryService(prisma, access, storage, events, realtime);
  // findOne re-reads and presents; stub it so these tests assert the decision
  // logic rather than the read path (covered by its own assertions below).
  jest.spyOn(service, 'findOne').mockImplementation(() => Promise.resolve(entry as never));

  return { service, prisma, events, realtime, updated };
}

describe('GateEntryService — resident decisions', () => {
  it('lets the resident the entry is for approve it, with no gate permission', async () => {
    const { service, updated, realtime, events } = makeService();

    await service.approve('ge-1', {}, RESIDENT);

    expect(updated).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GateEntryStatus.APPROVED,
          decidedById: RESIDENT.id,
        }),
      }),
    );
    // Security must see it without refreshing — that is the whole feature.
    expect(realtime.publish).toHaveBeenCalledWith(
      'gate.entry.decided',
      { communityRoom: { communityId: 'c-1', room: 'gate' } },
      expect.anything(),
    );
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'gate_entry.approved' }),
    );
  });

  it('refuses a resident who is not the one the entry is for', async () => {
    const { service, updated } = makeService({ myResidents: [{ id: 'res-someone-else' }] });

    await expect(service.approve('ge-1', {}, RESIDENT)).rejects.toBeInstanceOf(ForbiddenException);
    expect(updated).not.toHaveBeenCalled();
  });

  it('lets a manager decide on the resident’s behalf', async () => {
    const { service, updated } = makeService({ myResidents: [] });

    await service.reject('ge-1', { note: 'Resident unreachable' }, MANAGER);

    expect(updated).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GateEntryStatus.REJECTED,
          decisionNote: 'Resident unreachable',
        }),
      }),
    );
  });

  it('refuses to decide an entry that is already decided', async () => {
    const { service } = makeService({ entry: { status: GateEntryStatus.APPROVED } });

    await expect(service.approve('ge-1', {}, RESIDENT)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to decide a completed entry', async () => {
    const { service } = makeService({ entry: { status: GateEntryStatus.COMPLETED } });

    await expect(service.reject('ge-1', {}, RESIDENT)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GateEntryService — gate-side lifecycle', () => {
  it('completes only an approved entry', async () => {
    const { service, updated } = makeService({ entry: { status: GateEntryStatus.APPROVED } });

    await service.complete('ge-1', MANAGER);

    expect(updated).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: GateEntryStatus.COMPLETED }),
      }),
    );
  });

  it('refuses to complete an entry the resident has not approved', async () => {
    const { service } = makeService({ entry: { status: GateEntryStatus.NOTIFIED } });

    await expect(service.complete('ge-1', MANAGER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to cancel an already completed entry', async () => {
    const { service } = makeService({ entry: { status: GateEntryStatus.COMPLETED } });

    await expect(service.cancel('ge-1', {}, MANAGER)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GateEntryService — notification outcome', () => {
  it('advances CREATED → NOTIFIED and records the channels used', async () => {
    const { service, updated, prisma } = makeService({ entry: { status: GateEntryStatus.CREATED } });
    (prisma.gateEntry.findUnique as jest.Mock).mockResolvedValue({
      id: 'ge-1', communityId: 'c-1', status: GateEntryStatus.CREATED,
    });

    await service.markNotified('ge-1', { channels: ['inapp', 'push'], failed: false });

    expect(updated).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GateEntryStatus.NOTIFIED,
          notificationFailed: false,
        }),
      }),
    );
    expect(prisma.gateEntryTimeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'NOTIFICATION_SENT', channel: 'inapp,push' }),
      }),
    );
  });

  it('flags the entry when no channel reached the resident', async () => {
    const { service, updated, prisma } = makeService({ entry: { status: GateEntryStatus.CREATED } });
    (prisma.gateEntry.findUnique as jest.Mock).mockResolvedValue({
      id: 'ge-1', communityId: 'c-1', status: GateEntryStatus.CREATED,
    });

    await service.markNotified('ge-1', { channels: [], failed: true });

    expect(updated).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GateEntryStatus.CREATED,
          notificationFailed: true,
          notifiedAt: null,
        }),
      }),
    );
  });

  /**
   * The race that matters: a resident can approve from a push notification
   * before the queued in-app job drains. Marking them NOTIFIED afterwards would
   * drag an APPROVED entry backwards and re-open it at the gate.
   */
  it('never drags an already-decided entry back to NOTIFIED', async () => {
    const { service, updated, prisma } = makeService();
    (prisma.gateEntry.findUnique as jest.Mock).mockResolvedValue({
      id: 'ge-1', communityId: 'c-1', status: GateEntryStatus.APPROVED,
    });

    await service.markNotified('ge-1', { channels: ['inapp'], failed: false });

    expect(updated).not.toHaveBeenCalled();
  });
});
