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
    ctx: { tenantId: string | null; isPlatform: boolean },
  ) => {
    const prisma = {
      community: { findFirst: jest.fn().mockResolvedValue(community) },
    } as unknown as PrismaService;
    const tenant = ctx as unknown as TenantContextService;
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
});
