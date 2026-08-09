/**
 * One resident per unit, plus their household.
 *
 * A unit holds exactly ONE occupant record representing the resident — owner,
 * tenant, primary, co-occupant — and any number of FAMILY_MEMBERs under them.
 * Two unrelated residents on one flat makes "whose flat is this" unanswerable
 * and sends notifications, gate approvals and maintenance bills to the wrong
 * household.
 *
 * The inverse stays open: one resident may hold MANY units, which is how an
 * owner with several flats works. Only the unit side is exclusive.
 */
type Occupant = { residentId: string; role: string };

/** Mirrors `assertUnitAvailable` — returns true when the assignment is allowed. */
function canAssign(existing: Occupant[], incoming: Occupant): boolean {
  if (incoming.role === 'FAMILY_MEMBER') return true;
  return !existing.some(
    (o) => o.residentId !== incoming.residentId && o.role !== 'FAMILY_MEMBER',
  );
}

describe('unit occupancy', () => {
  const owner: Occupant = { residentId: 'res-1', role: 'OWNER' };

  it('accepts the first resident on an empty unit', () => {
    expect(canAssign([], owner)).toBe(true);
  });

  it('refuses a SECOND unrelated resident on the same unit', () => {
    expect(canAssign([owner], { residentId: 'res-2', role: 'TENANT' })).toBe(false);
    expect(canAssign([owner], { residentId: 'res-2', role: 'OWNER' })).toBe(false);
    expect(canAssign([owner], { residentId: 'res-2', role: 'PRIMARY' })).toBe(false);
  });

  it('allows family members onto an occupied unit — that is the point', () => {
    expect(canAssign([owner], { residentId: 'res-2', role: 'FAMILY_MEMBER' })).toBe(true);
    expect(
      canAssign(
        [owner, { residentId: 'res-2', role: 'FAMILY_MEMBER' }],
        { residentId: 'res-3', role: 'FAMILY_MEMBER' },
      ),
    ).toBe(true);
  });

  it('lets the SAME resident be re-saved without tripping over themselves', () => {
    // Editing an existing assignment must not read as a second occupant.
    expect(canAssign([owner], { residentId: 'res-1', role: 'OWNER' })).toBe(true);
  });

  it('frees the unit once the previous resident is gone', () => {
    expect(canAssign([], { residentId: 'res-2', role: 'TENANT' })).toBe(true);
  });

  it('does not stop a family member becoming the resident after the others leave', () => {
    expect(
      canAssign(
        [{ residentId: 'res-2', role: 'FAMILY_MEMBER' }],
        { residentId: 'res-2', role: 'OWNER' },
      ),
    ).toBe(true);
  });
});

/**
 * The owner-side rule, stated separately so nobody "tightens" the check above
 * into a symmetric one. Owning several flats is normal and must keep working.
 */
describe('one resident, many units', () => {
  const unitsFor = (assignments: { residentId: string; unitId: string }[], residentId: string) =>
    assignments.filter((a) => a.residentId === residentId).map((a) => a.unitId);

  it('an owner may hold several units', () => {
    const assignments = [
      { residentId: 'res-1', unitId: 'A-101' },
      { residentId: 'res-1', unitId: 'A-102' },
      { residentId: 'res-1', unitId: 'B-201' },
    ];
    expect(unitsFor(assignments, 'res-1')).toHaveLength(3);
  });
});
