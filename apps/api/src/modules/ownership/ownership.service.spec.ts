import { OwnershipStatus, ResidentRole } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OwnershipService } from './ownership.service';

/**
 * Who is financially responsible for a flat.
 *
 * The reported failure: maintenance was attached to whoever occupied the unit,
 * so a tenant read — and was chased for — their landlord's bills. Ownership and
 * occupancy are different relations here, and every financial surface resolves
 * through this service, so these are the tests that decide whether a tenant can
 * reach an owner's money anywhere in the platform.
 */
const OWNER: AuthenticatedUser = {
  id: 'user-owner', email: 'john@example.com', tenantId: 't-1', tenantIds: ['t-1'],
  roles: [], permissions: [],
};
const TENANT: AuthenticatedUser = { ...OWNER, id: 'user-tenant', email: 'rahul@example.com' };

/**
 * @param ownerships rows in unit_ownerships
 * @param occupancies rows in resident_units
 * @param residents which resident ids each user id backs
 */
function build(opts: {
  ownerships?: { unitId: string; residentId: string; isPrimary?: boolean }[];
  occupancies?: { unitId: string; residentId: string; role: ResidentRole }[];
  residents?: Record<string, string[]>;
}) {
  const ownerships = opts.ownerships ?? [];
  const occupancies = opts.occupancies ?? [];
  const residents = opts.residents ?? {};

  const prisma = {
    resident: {
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve((residents[where.userId] ?? []).map((id) => ({ id }))),
      ),
    },
    unitOwnership: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const byResident = where.residentId as { in: string[] } | undefined;
        const byUnitOne = where.unitId as string | { in: string[] } | undefined;
        return Promise.resolve(
          ownerships
            .filter((o) => (byResident ? byResident.in.includes(o.residentId) : true))
            .filter((o) =>
              !byUnitOne
                ? true
                : typeof byUnitOne === 'string'
                  ? o.unitId === byUnitOne
                  : byUnitOne.in.includes(o.unitId),
            )
            .map((o) => ({
              id: `own-${o.unitId}-${o.residentId}`,
              unitId: o.unitId,
              residentId: o.residentId,
              isPrimary: o.isPrimary ?? true,
              sharePercent: null,
              startDate: null,
              status: OwnershipStatus.ACTIVE,
              resident: {
                id: o.residentId, firstName: 'X', lastName: 'Y', mobile: '9', email: null,
                status: 'ACTIVE', userId: null, user: null,
              },
            })),
        );
      }),
    },
    residentUnit: {
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const byResident = where.residentId as { in: string[] } | undefined;
        const roleFilter = where.role as { notIn: ResidentRole[] } | undefined;
        return Promise.resolve(
          occupancies
            .filter((o) => (byResident ? byResident.in.includes(o.residentId) : true))
            .filter((o) => (roleFilter ? !roleFilter.notIn.includes(o.role) : true))
            .map((o) => ({ unitId: o.unitId, residentId: o.residentId, role: o.role })),
        );
      }),
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const roleFilter = where.role as { notIn: ResidentRole[] } | undefined;
        const match = occupancies
          .filter((o) => o.unitId === where.unitId)
          .filter((o) => (roleFilter ? !roleFilter.notIn.includes(o.role) : true))[0];
        return Promise.resolve(match ? { residentId: match.residentId } : null);
      }),
    },
  };
  return new OwnershipService(prisma as never);
}

/** Unit 101: John owns it, Rahul rents it. The scenario from the report. */
const TENANTED = {
  ownerships: [{ unitId: 'u-101', residentId: 'res-john' }],
  occupancies: [{ unitId: 'u-101', residentId: 'res-rahul', role: ResidentRole.TENANT }],
  residents: { 'user-owner': ['res-john'], 'user-tenant': ['res-rahul'] },
};

describe('financial responsibility', () => {
  it('bills the owner, not the person living there', async () => {
    const svc = build(TENANTED);
    expect(await svc.billableResidentFor('u-101')).toBe('res-john');
  });

  it('lets the owner see the unit’s money', async () => {
    const svc = build(TENANTED);
    expect(await svc.canAccessUnitFinancials(OWNER, 'u-101')).toBe(true);
  });

  it('refuses the tenant, even though they live there', async () => {
    const svc = build(TENANTED);
    expect(await svc.canAccessUnitFinancials(TENANT, 'u-101')).toBe(false);
    expect(await svc.financiallyVisibleUnitIds(TENANT)).toEqual([]);
  });

  it('notifies the owner about the bill and nobody else', async () => {
    const svc = build(TENANTED);
    expect(await svc.notifiableResidentsFor('u-101')).toEqual(['res-john']);
  });
});

describe('an owner who lives in their own flat', () => {
  const OWNER_OCCUPIED = {
    ownerships: [{ unitId: 'u-1', residentId: 'res-john' }],
    occupancies: [{ unitId: 'u-1', residentId: 'res-john', role: ResidentRole.OWNER }],
    residents: { 'user-owner': ['res-john'] },
  };

  it('sees their unit once, not twice', async () => {
    const svc = build(OWNER_OCCUPIED);
    expect(await svc.financiallyVisibleUnitIds(OWNER)).toEqual(['u-1']);
  });
});

describe('an owner with several flats', () => {
  const PORTFOLIO = {
    ownerships: [
      { unitId: 'u-101', residentId: 'res-john' },
      { unitId: 'u-204', residentId: 'res-john' },
      { unitId: 'u-508', residentId: 'res-john' },
    ],
    residents: { 'user-owner': ['res-john'] },
  };

  it('sees every one of them', async () => {
    const svc = build(PORTFOLIO);
    const units = await svc.myOwnedUnitIds(OWNER);
    expect(units.sort()).toEqual(['u-101', 'u-204', 'u-508']);
  });
});

describe('a jointly-held flat', () => {
  const JOINT = {
    ownerships: [
      { unitId: 'u-1', residentId: 'res-john', isPrimary: true },
      { unitId: 'u-1', residentId: 'res-mary', isPrimary: false },
    ],
    residents: { 'user-owner': ['res-john'], 'user-tenant': ['res-mary'] },
  };

  it('bills the primary owner', async () => {
    expect(await build(JOINT).billableResidentFor('u-1')).toBe('res-john');
  });

  it('but tells both of them', async () => {
    // A co-owner who never hears about the bill cannot help pay it.
    expect(await build(JOINT).notifiableResidentsFor('u-1')).toEqual(['res-john', 'res-mary']);
  });

  it('and both can see it', async () => {
    const svc = build(JOINT);
    expect(await svc.canAccessUnitFinancials(OWNER, 'u-1')).toBe(true);
    expect(await svc.canAccessUnitFinancials({ ...TENANT }, 'u-1')).toBe(true);
  });
});

/** Owners only: occupancy, in any role, never stands in for a missing owner. */
describe('a unit with no owner on record', () => {
  it('is billed to nobody and nobody resident-side sees it', async () => {
    const svc = build({
      occupancies: [{ unitId: 'u-1', residentId: 'res-john', role: ResidentRole.PRIMARY }],
      residents: { 'user-owner': ['res-john'] },
    });
    expect(await svc.billableResidentFor('u-1')).toBeNull();
    expect(await svc.notifiableResidentsFor('u-1')).toEqual([]);
    expect(await svc.canAccessUnitFinancials(OWNER, 'u-1')).toBe(false);
  });

  it('never names a tenant', async () => {
    const svc = build({
      occupancies: [{ unitId: 'u-1', residentId: 'res-rahul', role: ResidentRole.TENANT }],
      residents: { 'user-tenant': ['res-rahul'] },
    });
    expect(await svc.billableResidentFor('u-1')).toBeNull();
    expect(await svc.canAccessUnitFinancials(TENANT, 'u-1')).toBe(false);
  });

  it('a non-owner occupant stays out once an owner is recorded', async () => {
    const svc = build({
      ownerships: [{ unitId: 'u-1', residentId: 'res-john' }],
      occupancies: [{ unitId: 'u-1', residentId: 'res-sam', role: ResidentRole.SECONDARY }],
      residents: { 'user-owner': ['res-john'], 'user-tenant': ['res-sam'] },
    });
    expect(await svc.canAccessUnitFinancials(TENANT, 'u-1')).toBe(false);
    expect(await svc.canAccessUnitFinancials(OWNER, 'u-1')).toBe(true);
  });
});

describe('cross-unit and cross-person access', () => {
  it('an owner cannot see another owner’s flat', async () => {
    const svc = build({
      ownerships: [
        { unitId: 'u-1', residentId: 'res-john' },
        { unitId: 'u-2', residentId: 'res-mary' },
      ],
      residents: { 'user-owner': ['res-john'] },
    });
    expect(await svc.canAccessUnitFinancials(OWNER, 'u-1')).toBe(true);
    expect(await svc.canAccessUnitFinancials(OWNER, 'u-2')).toBe(false);
  });

  it('someone with no resident record sees nothing', async () => {
    const svc = build({ ownerships: [{ unitId: 'u-1', residentId: 'res-john' }] });
    expect(await svc.financiallyVisibleUnitIds(OWNER)).toEqual([]);
    expect(await svc.canAccessUnitFinancials(OWNER, 'u-1')).toBe(false);
  });

  it('a family member is not a financial party', async () => {
    const svc = build({
      occupancies: [{ unitId: 'u-1', residentId: 'res-kid', role: ResidentRole.FAMILY_MEMBER }],
      residents: { 'user-tenant': ['res-kid'] },
    });
    expect(await svc.canAccessUnitFinancials(TENANT, 'u-1')).toBe(false);
  });
});
