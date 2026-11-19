import { ResidentService } from './resident.service';

/**
 * Adding an OWNER from the resident form must work whether or not a tenant
 * lives in the flat, and never cost either person their login.
 */
describe('ResidentService.create — owners', () => {
  const actor = { id: 'admin-1' } as never;
  const tenant = { residentId: 'tenant-1', resident: { firstName: 'Tara', lastName: 'Tenant' } };

  function build({ occupant, known, owner = { id: 'own-1' } }: {
    occupant: unknown; known?: { id: string; mobile: string }; owner?: unknown;
  }) {
    const prisma = {
      unit: { findFirst: jest.fn().mockResolvedValue({ communityId: 'c1' }) },
      resident: {
        findMany: jest.fn().mockResolvedValue(known ? [{ firstName: 'O', lastName: 'W', ...known }] : []),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'owner-1', residentCode: 'R-1' }),
      },
      residentUnit: {
        findFirst: jest.fn().mockResolvedValue(occupant),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      unitOwnership: {
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(owner),
      },
    };
    const accounts = {
      provisionLoginWithCredential: jest.fn().mockResolvedValue({ userId: 'u-owner', temporaryPassword: 'ABCD-EFGH-JKMN' }),
    };
    const svc = new ResidentService(
      prisma as never,
      { assert: jest.fn().mockResolvedValue({ tenantId: 't1' }) } as never,
      {} as never,
      {} as never,
      accounts as never,
      { publish: jest.fn(), from: jest.fn() } as never,
      {} as never,
    );
    jest.spyOn(svc, 'findOne').mockImplementation(async (id: string) => ({ id, communityId: 'c1' }) as never);
    return { svc, prisma, accounts };
  }

  const dto = { firstName: 'Omar', lastName: 'Owner', mobile: '9876543210', occupiedBy: 'OWNER', unitId: 'u1' } as never;

  it('records a NEW owner of a tenanted flat as owner only, with their own one-time password', async () => {
    const { svc, prisma } = build({ occupant: tenant });
    const res = await svc.create('c1', dto, actor);
    expect(res.temporaryPassword).toBe('ABCD-EFGH-JKMN');
    expect(prisma.residentUnit.upsert).not.toHaveBeenCalled(); // tenant stays the occupant
    expect(prisma.unitOwnership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ unitId: 'u1', residentId: 'owner-1', isPrimary: true }) }),
    );
  });

  it('makes a new owner the occupant too when the flat is empty', async () => {
    const { svc, prisma } = build({ occupant: null });
    await svc.create('c1', dto, actor);
    expect(prisma.residentUnit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ unitId: 'u1', role: 'OWNER' }) }),
    );
    expect(prisma.unitOwnership.upsert).toHaveBeenCalled();
  });

  it('links an owner already known by mobile instead of refusing a duplicate — login untouched', async () => {
    const { svc, prisma, accounts } = build({ occupant: tenant, known: { id: 'owner-0', mobile: '+91 98765 43210' } });
    const res = await svc.create('c1', dto, actor);
    expect(res.id).toBe('owner-0');
    expect(res.temporaryPassword).toBeNull();
    expect(accounts.provisionLoginWithCredential).not.toHaveBeenCalled();
    expect(prisma.resident.create).not.toHaveBeenCalled();
    expect(prisma.unitOwnership.upsert).toHaveBeenCalled();
  });

  it('refuses a tenant (or anyone but the owner) in a unit with no owner on record', async () => {
    const { svc, accounts } = build({ occupant: null, owner: null });
    await expect(svc.create('c1', { ...(dto as object), occupiedBy: 'TENANT' } as never, actor)).rejects.toThrow(
      /no owner on record/,
    );
    expect(accounts.provisionLoginWithCredential).not.toHaveBeenCalled(); // nothing written
  });

  it('still lets the OWNER be added to an ownerless unit — that is how the gap closes', async () => {
    const { svc, prisma } = build({ occupant: null, owner: null });
    await svc.create('c1', dto, actor);
    expect(prisma.unitOwnership.upsert).toHaveBeenCalled();
  });

  it('still refuses a second TENANT on an occupied flat', async () => {
    const { svc } = build({ occupant: tenant });
    await expect(svc.create('c1', { ...(dto as object), occupiedBy: 'TENANT' } as never, actor)).rejects.toThrow(
      /already occupied/,
    );
  });
});
