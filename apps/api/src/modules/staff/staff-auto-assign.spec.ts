import type { PrismaService } from '../prisma/prisma.service';
import { StaffAutoAssignService } from './staff-auto-assign.service';

interface StaffRow {
  id: string;
  firstName: string;
  lastName: string;
  categories: string[];
}

function makeService(
  staff: StaffRow[],
  workload: { ticket?: Record<string, number>; request?: Record<string, number> } = {},
) {
  const toGroups = (counts: Record<string, number> = {}, key: 'assignedStaffId') =>
    Object.entries(counts).map(([id, n]) => ({ [key]: id, _count: { _all: n } }));

  const prisma = {
    staff: { findMany: jest.fn().mockResolvedValue(staff) },
    ticket: {
      groupBy: jest.fn().mockResolvedValue(toGroups(workload.ticket, 'assignedStaffId')),
    },
    serviceRequest: {
      groupBy: jest.fn().mockResolvedValue(toGroups(workload.request, 'assignedStaffId')),
    },
  } as unknown as PrismaService;

  return { service: new StaffAutoAssignService(prisma), prisma };
}

const PLUMBER: StaffRow = {
  id: 'staff-plumber',
  firstName: 'Ravi',
  lastName: 'Kumar',
  categories: ['PLUMBING'],
};
const ELECTRICIAN: StaffRow = {
  id: 'staff-electrician',
  firstName: 'Meera',
  lastName: 'Nair',
  categories: ['ELECTRICAL'],
};

describe('StaffAutoAssignService', () => {
  it('picks a staff member whose categories cover the request', async () => {
    const { service } = makeService([PLUMBER, ELECTRICIAN]);

    const picked = await service.pick({ communityId: 'c-1', categories: ['PLUMBING'] });

    expect(picked).toMatchObject({ staffId: 'staff-plumber', staffName: 'Ravi Kumar' });
  });

  it('returns null when nobody covers the category — admin assigns manually', async () => {
    const { service } = makeService([PLUMBER, ELECTRICIAN]);

    await expect(
      service.pick({ communityId: 'c-1', categories: ['CARPENTRY'] }),
    ).resolves.toBeNull();
  });

  /** The "no category allocated" case from the spec. */
  it('never auto-assigns a staff member with no categories', async () => {
    const { service } = makeService([
      { id: 'staff-generalist', firstName: 'Anil', lastName: 'Rao', categories: [] },
    ]);

    await expect(
      service.pick({ communityId: 'c-1', categories: ['PLUMBING'] }),
    ).resolves.toBeNull();
  });

  it('prefers the least-loaded of several matches', async () => {
    const busy = { ...PLUMBER, id: 'staff-busy', firstName: 'Busy' };
    const free = { ...PLUMBER, id: 'staff-free', firstName: 'Free' };
    const { service } = makeService([busy, free], {
      ticket: { 'staff-busy': 3 },
      request: { 'staff-busy': 2, 'staff-free': 1 },
    });

    const picked = await service.pick({ communityId: 'c-1', categories: ['PLUMBING'] });

    expect(picked?.staffId).toBe('staff-free');
    expect(picked?.openWorkload).toBe(1);
  });

  it('counts tickets AND service requests as workload', async () => {
    const { service } = makeService([PLUMBER], {
      ticket: { 'staff-plumber': 2 },
      request: { 'staff-plumber': 3 },
    });

    const picked = await service.pick({ communityId: 'c-1', categories: ['PLUMBING'] });

    expect(picked?.openWorkload).toBe(5);
  });

  /**
   * Category values are admin-managed free text, so the same category is spelled
   * differently between the catalogue and the staff record more often than not.
   */
  it('matches regardless of case, spacing and separators', async () => {
    const { service } = makeService([
      { id: 's-1', firstName: 'A', lastName: 'B', categories: ['pest control'] },
    ]);

    for (const wanted of ['PEST_CONTROL', 'Pest-Control', ' pest control ']) {
      await expect(
        service.pick({ communityId: 'c-1', categories: [wanted] }),
      ).resolves.toMatchObject({ staffId: 's-1' });
    }
  });

  it('breaks ties by name so the choice is deterministic', async () => {
    const { service } = makeService([
      { ...PLUMBER, id: 's-zara', firstName: 'Zara' },
      { ...PLUMBER, id: 's-amit', firstName: 'Amit' },
    ]);

    const picked = await service.pick({ communityId: 'c-1', categories: ['PLUMBING'] });

    expect(picked?.staffId).toBe('s-amit');
  });

  it('returns nothing when asked with no categories at all', async () => {
    const { service, prisma } = makeService([PLUMBER]);

    await expect(service.pick({ communityId: 'c-1', categories: [] })).resolves.toBeNull();
    // Short-circuits before touching the database.
    expect(prisma.staff.findMany).not.toHaveBeenCalled();
  });

  it('lists every candidate least-loaded first for the admin UI', async () => {
    const { service } = makeService(
      [
        { ...PLUMBER, id: 's-a', firstName: 'A' },
        { ...PLUMBER, id: 's-b', firstName: 'B' },
      ],
      { ticket: { 's-a': 4 } },
    );

    const candidates = await service.candidates({ communityId: 'c-1', categories: ['PLUMBING'] });

    expect(candidates.map((c) => c.staffId)).toEqual(['s-b', 's-a']);
  });
});
