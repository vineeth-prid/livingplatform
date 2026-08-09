import { NotFoundException } from '@nestjs/common';

import { CommunityAccessService } from './community-access.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { TenantContextService } from './tenant-context.service';

/**
 * Tenant-isolation tests — the core multi-tenant guarantee. A caller must never
 * reach a community outside their tenant, and cross-tenant access must look
 * identical to "not found" (no existence leak). Platform principals bypass.
 */
describe('CommunityAccessService (tenant isolation)', () => {
  const makeService = (
    community: { id: string; tenantId: string } | null,
    ctx: { tenantId: string | null; isPlatform: boolean; tenantIds?: string[] },
  ) => {
    const prisma = {
      community: { findFirst: jest.fn().mockResolvedValue(community) },
    } as unknown as PrismaService;
    // Mirrors the real context: reachable tenants default to the home tenant.
    const tenantIds = ctx.tenantIds ?? (ctx.tenantId ? [ctx.tenantId] : []);
    const tenant = {
      ...ctx,
      tenantIds,
      canAccessTenant: (id: string | null | undefined) =>
        ctx.isPlatform || (!!id && tenantIds.includes(id)),
    } as unknown as TenantContextService;
    return new CommunityAccessService(prisma, tenant);
  };

  it('allows access within the same tenant', async () => {
    const svc = makeService(
      { id: 'c1', tenantId: 't1' },
      { tenantId: 't1', isPlatform: false },
    );
    await expect(svc.assert('c1')).resolves.toEqual({ id: 'c1', tenantId: 't1' });
  });

  it('denies (as 404) a community in another tenant', async () => {
    const svc = makeService(
      { id: 'c1', tenantId: 't2' },
      { tenantId: 't1', isPlatform: false },
    );
    await expect(svc.assert('c1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets a platform principal cross tenants', async () => {
    const svc = makeService(
      { id: 'c1', tenantId: 't2' },
      { tenantId: null, isPlatform: true },
    );
    await expect(svc.assert('c1')).resolves.toEqual({ id: 'c1', tenantId: 't2' });
  });

  it('throws 404 when the community does not exist', async () => {
    const svc = makeService(null, { tenantId: 't1', isPlatform: false });
    await expect(svc.assert('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('scopes list queries to the tenant for non-platform callers', () => {
    const svc = makeService(null, { tenantId: 't1', isPlatform: false });
    expect(svc.tenantWhere()).toEqual({ tenantId: 't1' });
  });

  it('does not scope list queries for platform callers', () => {
    const svc = makeService(null, { tenantId: null, isPlatform: true });
    expect(svc.tenantWhere()).toEqual({});
  });

  /**
   * One human, one login, several communities.
   *
   * Each community is its own tenant, so an owner with flats in two societies —
   * or staff covering three — legitimately spans tenants. Isolation still holds:
   * they reach the tenants they hold a grant in and nothing else.
   */
  describe('a person who belongs to several communities', () => {
    it('reaches a community in ANY tenant they hold a grant in', async () => {
      const svc = makeService(
        { id: 'c2', tenantId: 't2' },
        { tenantId: 't1', isPlatform: false, tenantIds: ['t1', 't2'] },
      );
      await expect(svc.assert('c2')).resolves.toEqual({ id: 'c2', tenantId: 't2' });
    });

    it('is still shut out of a tenant they hold nothing in', async () => {
      const svc = makeService(
        { id: 'c9', tenantId: 't9' },
        { tenantId: 't1', isPlatform: false, tenantIds: ['t1', 't2'] },
      );
      await expect(svc.assert('c9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('scopes list queries to every tenant they can reach', () => {
      const svc = makeService(null, {
        tenantId: 't1', isPlatform: false, tenantIds: ['t1', 't2'],
      });
      expect(svc.tenantWhere()).toEqual({ tenantId: { in: ['t1', 't2'] } });
    });

    it('a caller with no tenant at all matches nothing, rather than everything', () => {
      const svc = makeService(null, { tenantId: null, isPlatform: false, tenantIds: [] });
      expect(svc.tenantWhere()).toEqual({ tenantId: '__no_tenant__' });
    });
  });
});
