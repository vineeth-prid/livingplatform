import { Logger } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';

import { WorkOrderService } from './work-order.service';

/**
 * Auto-assignment for work orders.
 *
 * Preventive maintenance generates a work order from an asset with nobody to do
 * it. Tickets and service requests have gone to the least-loaded matching vendor
 * since Sprint B; work orders were never wired to the same picker, so every
 * generated maintenance job sat unassigned until a human noticed.
 *
 * The rules that matter: only on approval (not while the spend is undecided),
 * only when nobody already owns it, only when the asset says what trade it
 * needs — and never at the cost of the work order itself.
 */
const W = WorkOrderStatus;

type Picked = { vendorId: string; vendorName: string; openWorkload: number } | null;

function build(opts: {
  picked?: Picked;
  asset?: { category: { name: string } | null; community: { tenantId: string } } | null;
  pickThrows?: boolean;
}) {
  const updates: Record<string, unknown>[] = [];
  const timeline: Record<string, unknown>[] = [];
  const prisma = {
    asset: { findUnique: jest.fn().mockResolvedValue(opts.asset ?? null) },
    workOrder: {
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return Promise.resolve({ id: 'wo-1', ...data });
      }),
    },
  };
  const autoAssign = {
    pick: jest.fn(() =>
      opts.pickThrows ? Promise.reject(new Error('vendor lookup exploded')) : Promise.resolve(opts.picked ?? null),
    ),
  };
  const svc = new WorkOrderService(
    prisma as never,
    {} as never,
    {} as never,
    { record: jest.fn((e: Record<string, unknown>) => { timeline.push(e); return Promise.resolve({ id: 't' }); }) } as never,
    {} as never,
    {} as never,
    autoAssign as never,
  );
  // Silence the expected error log in the "never throws" case.
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const call = (wo: Partial<Parameters<typeof tryAssign>[0]> = {}) =>
    tryAssign({
      id: 'wo-1', communityId: 'c-1', assetId: 'a-1',
      assignedStaffId: null, assignedVendorId: null, ...wo,
    });
  const tryAssign = (wo: {
    id: string; communityId: string; assetId: string | null;
    assignedStaffId: string | null; assignedVendorId: string | null;
  }) => (svc as unknown as {
    tryAutoAssign(w: typeof wo, a: unknown): Promise<unknown>;
  }).tryAutoAssign(wo, { id: 'user-1' });

  return { call, updates, timeline, prisma, autoAssign };
}

const ASSET = { category: { name: 'Elevators' }, community: { tenantId: 't-1' } };
const VENDOR = { vendorId: 'v-9', vendorName: 'Otis', openWorkload: 2 };

afterEach(() => jest.restoreAllMocks());

describe('work order auto-assignment', () => {
  it('gives an approved maintenance work order to the matching vendor', async () => {
    const { call, updates, autoAssign } = build({ asset: ASSET, picked: VENDOR });
    await call();

    // The asset's category is the only signal a maintenance job carries about
    // which trade it needs.
    expect(autoAssign.pick).toHaveBeenCalledWith({
      tenantId: 't-1', communityId: 'c-1', categories: ['Elevators'],
    });
    expect(updates[0]).toMatchObject({ assignedVendorId: 'v-9', status: W.ASSIGNED });
  });

  it('records the assignment as automatic, with no acting person', async () => {
    const { call, updates, timeline } = build({ asset: ASSET, picked: VENDOR });
    await call();
    // assignedById must stay absent: nobody made this call.
    expect(updates[0]).not.toHaveProperty('assignedById');
    expect(timeline[0]).toMatchObject({ metadata: { vendorId: 'v-9', auto: true } });
  });

  it('leaves a work order that already has an owner alone', async () => {
    for (const owned of [{ assignedVendorId: 'v-1' }, { assignedStaffId: 's-1' }]) {
      const { call, autoAssign, updates } = build({ asset: ASSET, picked: VENDOR });
      await call(owned);
      expect(autoAssign.pick).not.toHaveBeenCalled();
      expect(updates).toHaveLength(0);
    }
  });

  it('does nothing for a work order with no asset — there is no trade to match', async () => {
    const { call, autoAssign } = build({ asset: ASSET, picked: VENDOR });
    await call({ assetId: null });
    expect(autoAssign.pick).not.toHaveBeenCalled();
  });

  it('leaves it unassigned when no vendor matches, rather than failing', async () => {
    const { call, updates } = build({ asset: ASSET, picked: null });
    await expect(call()).resolves.toBeNull();
    expect(updates).toHaveLength(0);
  });

  /** Losing the assignment must never lose the work order. */
  it('swallows a picker failure and leaves the work order intact', async () => {
    const { call, updates } = build({ asset: ASSET, pickThrows: true });
    await expect(call()).resolves.toBeNull();
    expect(updates).toHaveLength(0);
  });

  it('does nothing when the asset has no category', async () => {
    const { call, autoAssign } = build({
      asset: { category: null, community: { tenantId: 't-1' } }, picked: VENDOR,
    });
    await call();
    expect(autoAssign.pick).not.toHaveBeenCalled();
  });
});
