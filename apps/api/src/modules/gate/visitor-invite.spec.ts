import { ForbiddenException } from '@nestjs/common';
import { GateEntryType } from '@prisma/client';

import { GateEntryService } from './gate-entry.service';

/**
 * A resident may invite a visitor to their own flat and nowhere else.
 *
 * This route carries no RBAC permission by design — residents hold none for the
 * gate — so the unit assignment IS the authorisation. If this check is wrong,
 * anyone with a resident login can put a stranger's arrival against any flat in
 * the community, and the occupant gets the approval prompt for a visitor they
 * never invited.
 */
describe('resident visitor invite', () => {
  const actor = { id: 'user-1', email: 'r@x' } as never;
  const dto = {
    unitId: 'unit-9',
    personName: 'Aditi Rao',
    mobileNumber: '9876543210',
    expectedArrival: new Date('2026-09-01T10:00:00Z'),
  };

  function build(assignment: unknown) {
    const prisma = {
      residentUnit: { findFirst: jest.fn().mockResolvedValue(assignment) },
    };
    const svc = new GateEntryService(
      prisma as never, {} as never, {} as never, {} as never, {} as never,
    );
    return { svc, prisma };
  }

  it('refuses a unit the caller does not occupy', async () => {
    // findFirst is scoped by BOTH unitId and the caller's userId, so a unit
    // belonging to someone else simply returns nothing.
    const { svc, prisma } = build(null);
    await expect(svc.inviteVisitor(dto, actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.residentUnit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          unitId: 'unit-9',
          resident: expect.objectContaining({ userId: 'user-1' }),
        }),
      }),
    );
  });

  it('creates a VISITOR gate entry against the resident’s own unit', async () => {
    const { svc } = build({
      residentId: 'res-1',
      unit: { id: 'unit-9', communityId: 'c-1', unitNumber: 'A-101' },
    });
    const create = jest.fn().mockResolvedValue({ id: 'ge-1' });
    (svc as unknown as { create: unknown }).create = create;

    await svc.inviteVisitor(dto, actor);

    // The community comes from the unit, never from the caller — a resident
    // cannot name one.
    expect(create).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({
        entryType: GateEntryType.VISITOR,
        unitId: 'unit-9',
        residentId: 'res-1',
        personName: 'Aditi Rao',
        expectedArrival: dto.expectedArrival,
      }),
      actor,
    );
  });

  it('never lets the caller choose the resident the entry is filed against', async () => {
    const { svc } = build({
      residentId: 'res-1',
      unit: { id: 'unit-9', communityId: 'c-1', unitNumber: 'A-101' },
    });
    const create = jest.fn().mockResolvedValue({ id: 'ge-1' });
    (svc as unknown as { create: unknown }).create = create;

    // A forged residentId on the payload must be ignored: it is resolved from
    // the assignment, not read from the request.
    await svc.inviteVisitor({ ...dto, residentId: 'someone-else' } as never, actor);
    expect(create.mock.calls[0]![1].residentId).toBe('res-1');
  });
});
