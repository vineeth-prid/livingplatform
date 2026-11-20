import { UnitService } from './unit.service';

/**
 * "Owner occupied" on the unit form means the owner LIVES there: they are
 * recorded as the flat's occupant as well as its owner, so the resident app
 * gives them their home (services, visitors, family), not just their dues.
 */
describe('UnitService.create — owner occupied', () => {
  const actor = { id: 'admin-1' } as never;

  function build(home: unknown = null) {
    const prisma = {
      unit: { create: jest.fn().mockResolvedValue({ id: 'unit-1', unitNumber: 'A-101' }), delete: jest.fn() },
      residentUnit: { findUnique: jest.fn().mockResolvedValue(home) },
    };
    const owners = { add: jest.fn().mockResolvedValue({ residentId: 'owner-1', temporaryPassword: 'ABCD-EFGH-JKMN' }) };
    const residents = { assignUnit: jest.fn() };
    const svc = new UnitService(
      prisma as never,
      { assert: jest.fn() } as never,
      { publish: jest.fn(), from: jest.fn() } as never,
      owners as never,
      residents as never,
    );
    jest.spyOn(svc as never, 'assertAncestors').mockResolvedValue(undefined as never);
    return { svc, residents };
  }
  const dto = (ownership?: string) => ({ unitNumber: 'A-101', ownerName: 'Omar Owner', ownerPhone: '9876543210', ownership }) as never;

  it('records the owner as living in an OWNER_OCCUPIED unit', async () => {
    const { svc, residents } = build();
    await svc.create('c1', dto('OWNER_OCCUPIED'), actor);
    expect(residents.assignUnit).toHaveBeenCalledWith('owner-1', { unitId: 'unit-1', role: 'OWNER' }, actor);
  });

  it('leaves a TENANTED (or unspecified) unit empty for its tenant', async () => {
    for (const o of ['TENANTED', undefined]) {
      const { svc, residents } = build();
      await svc.create('c1', dto(o), actor);
      expect(residents.assignUnit).not.toHaveBeenCalled();
    }
  });

  it('does not move an owner who already lives in another flat', async () => {
    const { svc, residents } = build({ unitId: 'other-unit' });
    await svc.create('c1', dto('OWNER_OCCUPIED'), actor);
    expect(residents.assignUnit).not.toHaveBeenCalled();
  });
});
