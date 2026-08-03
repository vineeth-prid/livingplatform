import { PersonStatus } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import { VendorAutoAssignService } from './vendor-auto-assign.service';

type Vendor = {
  id: string;
  name: string;
  category: string;
  serviceCategories: string[];
};

/**
 * A Prisma stand-in that answers the three queries the picker makes: eligible
 * vendors, open tickets per vendor, and open service requests per vendor.
 */
const makeService = (
  vendors: Vendor[],
  workload: { tickets?: Record<string, number>; requests?: Record<string, number> } = {},
) => {
  const group = (counts: Record<string, number> = {}) =>
    Object.entries(counts).map(([assignedVendorId, n]) => ({
      assignedVendorId,
      _count: { _all: n },
    }));

  const prisma = {
    vendor: { findMany: jest.fn().mockResolvedValue(vendors) },
    ticket: { groupBy: jest.fn().mockResolvedValue(group(workload.tickets)) },
    serviceRequest: { groupBy: jest.fn().mockResolvedValue(group(workload.requests)) },
  } as unknown as PrismaService;
  return { service: new VendorAutoAssignService(prisma), prisma };
};

const input = { tenantId: 't1', communityId: 'c1', categories: ['PLUMBING', 'Plumbing'] };

describe('VendorAutoAssignService.pick', () => {
  it('picks the only matching vendor', async () => {
    const { service } = makeService([
      { id: 'v1', name: 'Acme Plumbing', category: 'PLUMBING', serviceCategories: [] },
    ]);
    await expect(service.pick(input)).resolves.toMatchObject({ vendorId: 'v1' });
  });

  it('matches on serviceCategories, not just the primary category', async () => {
    const { service } = makeService([
      { id: 'v1', name: 'Multi Services', category: 'GENERAL', serviceCategories: ['PLUMBING'] },
    ]);
    await expect(service.pick(input)).resolves.toMatchObject({ vendorId: 'v1' });
  });

  it('matches case- and separator-insensitively', async () => {
    const { service } = makeService([
      { id: 'v1', name: 'Acme', category: 'plumbing services', serviceCategories: [] },
    ]);
    await expect(
      service.pick({ ...input, categories: ['Plumbing_Services'] }),
    ).resolves.toMatchObject({ vendorId: 'v1' });
  });

  it('prefers the least loaded vendor', async () => {
    const { service } = makeService(
      [
        { id: 'busy', name: 'Busy Co', category: 'PLUMBING', serviceCategories: [] },
        { id: 'free', name: 'Free Co', category: 'PLUMBING', serviceCategories: [] },
      ],
      { tickets: { busy: 4 }, requests: { busy: 2, free: 1 } },
    );
    const picked = await service.pick(input);
    expect(picked).toMatchObject({ vendorId: 'free', openWorkload: 1 });
  });

  it('counts tickets AND service requests as workload', async () => {
    const { service } = makeService(
      [
        { id: 'a', name: 'A', category: 'PLUMBING', serviceCategories: [] },
        { id: 'b', name: 'B', category: 'PLUMBING', serviceCategories: [] },
      ],
      // "a" looks free on requests alone, but has 3 open tickets.
      { tickets: { a: 3 }, requests: { b: 2 } },
    );
    await expect(service.pick(input)).resolves.toMatchObject({ vendorId: 'b', openWorkload: 2 });
  });

  it('breaks ties by name so the choice is deterministic', async () => {
    const { service } = makeService([
      { id: 'z', name: 'Zeta', category: 'PLUMBING', serviceCategories: [] },
      { id: 'a', name: 'Alpha', category: 'PLUMBING', serviceCategories: [] },
    ]);
    await expect(service.pick(input)).resolves.toMatchObject({ vendorId: 'a' });
  });

  it('returns null when no vendor covers the category', async () => {
    const { service } = makeService([
      { id: 'v1', name: 'Electric Co', category: 'ELECTRICAL', serviceCategories: [] },
    ]);
    await expect(service.pick(input)).resolves.toBeNull();
  });

  it('returns null when there are no vendors at all', async () => {
    const { service } = makeService([]);
    await expect(service.pick(input)).resolves.toBeNull();
  });

  it('returns null when no category was supplied', async () => {
    const { service } = makeService([
      { id: 'v1', name: 'Acme', category: 'PLUMBING', serviceCategories: [] },
    ]);
    await expect(service.pick({ ...input, categories: [] })).resolves.toBeNull();
    await expect(service.pick({ ...input, categories: ['', '  '] })).resolves.toBeNull();
  });

  it('only considers ACTIVE vendors covering this community', async () => {
    const { service, prisma } = makeService([
      { id: 'v1', name: 'Acme', category: 'PLUMBING', serviceCategories: [] },
    ]);
    await service.pick(input);
    expect((prisma.vendor.findMany as jest.Mock).mock.calls[0][0].where).toMatchObject({
      tenantId: 't1',
      deletedAt: null,
      status: PersonStatus.ACTIVE,
      communityIds: { has: 'c1' },
    });
  });
});

describe('VendorAutoAssignService.candidates', () => {
  it('returns every eligible vendor, least loaded first', async () => {
    const { service } = makeService(
      [
        { id: 'a', name: 'A', category: 'PLUMBING', serviceCategories: [] },
        { id: 'b', name: 'B', category: 'PLUMBING', serviceCategories: [] },
        { id: 'c', name: 'C', category: 'ELECTRICAL', serviceCategories: [] },
      ],
      { requests: { a: 5, b: 1 } },
    );
    const candidates = await service.candidates(input);
    expect(candidates.map((c) => c.vendorId)).toEqual(['b', 'a']);
  });
});
