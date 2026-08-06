import { ForbiddenException } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';
import type { TenantContextService } from '../tenancy/tenant-context.service';
import { TicketCategoryService } from './ticket-category.service';

/**
 * Categories are the COMMUNITY's vocabulary, so a community admin edits and
 * withdraws them — including the platform defaults.
 *
 * The invariant that matters: a shared row (tenantId = null) is never mutated
 * on a community's behalf. One community renaming or hiding "Plumbing" must
 * leave every other community's catalogue exactly as it was.
 */
const SYSTEM = {
  id: 'cat-sys',
  tenantId: null,
  key: 'PLUMBING',
  name: 'Plumbing',
  description: null,
  color: null,
  iconKey: null,
  isActive: true,
  isSystem: true,
  sortOrder: 0,
};

function makeService(opts: { isPlatform: boolean; tenantId?: string | null; owned?: unknown }) {
  const tx = {
    ticketCategory: {
      findFirst: jest.fn().mockResolvedValue(opts.owned ?? null),
      create: jest.fn((args: { data: unknown }) => Promise.resolve({ id: 'cat-own', ...(args.data as object) })),
      update: jest.fn((args: { data: unknown }) => Promise.resolve({ id: 'cat-own', ...(args.data as object) })),
    },
    tenantCategorySetting: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ticketCategory: {
      findFirst: jest.fn().mockResolvedValue(SYSTEM),
      findMany: jest.fn().mockResolvedValue([SYSTEM]),
      update: jest.fn().mockResolvedValue({ ...SYSTEM, isActive: false }),
    },
    tenantCategorySetting: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaService;

  const tenant = {
    isPlatform: opts.isPlatform,
    // `??` would swallow an explicitly-null tenant, which is the case the
    // "no tenant context" test exists to cover.
    tenantId: 'tenantId' in opts ? opts.tenantId : 't-1',
  } as unknown as TenantContextService;

  return { service: new TicketCategoryService(prisma, tenant), prisma, tx };
}

describe('TicketCategoryService — community ownership of system defaults', () => {
  it('turning a system default off records an override, never touching the shared row', async () => {
    const { service, prisma } = makeService({ isPlatform: false });

    await service.setStatus('cat-sys', false);

    expect(prisma.tenantCategorySetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_categoryId: { tenantId: 't-1', categoryId: 'cat-sys' } },
        create: expect.objectContaining({ isActive: false }),
      }),
    );
    // The invariant: every other community still sees it.
    expect(prisma.ticketCategory.update).not.toHaveBeenCalled();
  });

  it('editing a system default copies it into the tenant and hides the original', async () => {
    const { service, prisma, tx } = makeService({ isPlatform: false });

    const result = await service.update('cat-sys', { name: 'Plumbing & drainage' });

    expect(tx.ticketCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 't-1', name: 'Plumbing & drainage', isSystem: false }),
      }),
    );
    expect(tx.tenantCategorySetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ isActive: false }) }),
    );
    expect(prisma.ticketCategory.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ name: 'Plumbing & drainage' });
  });

  it('unspecified fields are carried over from the default, not blanked', async () => {
    const { service, tx } = makeService({ isPlatform: false });

    await service.update('cat-sys', { name: 'Renamed' });

    expect(tx.ticketCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ key: 'PLUMBING', sortOrder: 0 }) }),
    );
  });

  it('a second edit updates the copy rather than colliding on tenant+key', async () => {
    const { service, tx } = makeService({
      isPlatform: false,
      owned: { id: 'cat-own', tenantId: 't-1', key: 'PLUMBING' },
    });

    await service.update('cat-sys', { name: 'Renamed again' });

    expect(tx.ticketCategory.update).toHaveBeenCalled();
    expect(tx.ticketCategory.create).not.toHaveBeenCalled();
  });

  it('a platform admin still edits the shared row directly', async () => {
    const { service, prisma } = makeService({ isPlatform: true });

    await service.update('cat-sys', { name: 'Plumbing' });

    expect(prisma.ticketCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cat-sys' } }),
    );
  });

  it('refuses to adopt without a tenant context', async () => {
    const { service } = makeService({ isPlatform: false, tenantId: null });

    await expect(service.update('cat-sys', { name: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a category the tenant switched off cannot be used on a new ticket', async () => {
    const { service, prisma } = makeService({ isPlatform: false });
    (prisma.tenantCategorySetting.findUnique as jest.Mock).mockResolvedValue({ isActive: false });

    await expect(service.assertUsable('cat-sys', 't-1')).rejects.toThrow(/not available/);
  });
});
