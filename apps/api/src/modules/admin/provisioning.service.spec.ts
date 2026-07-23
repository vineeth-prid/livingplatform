import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ProvisioningService } from './provisioning.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { TenantContextService } from '../tenancy/tenant-context.service';
import type { StorageService } from '../storage/storage.service';
import type { DomainEventsService } from '../events/domain-events.service';
import type { RbacService } from '../rbac/rbac.service';
import type { TokensService } from '../auth/tokens.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

/**
 * "Log in as community" is a privileged path: platform-only, and it must not
 * mint a session when the community has no admin to impersonate.
 */
describe('ProvisioningService.loginAsCommunity', () => {
  const actor = { id: 'p1', email: 'admin@living.local' } as AuthenticatedUser;

  const make = (opts: {
    isPlatform: boolean;
    community?: { id: string; tenantId: string; name: string } | null;
    admin?: { id: string; email: string; tenantId: string } | null;
  }) => {
    const prisma = {
      community: { findFirst: jest.fn().mockResolvedValue(opts.community ?? null) },
      user: { findFirst: jest.fn().mockResolvedValue(opts.admin ?? null) },
    } as unknown as PrismaService;
    const tenant = { isPlatform: opts.isPlatform } as unknown as TenantContextService;
    const rbac = {
      buildPrincipal: jest.fn().mockResolvedValue({ id: 'a1', email: 'assoc@x', tenantId: 't1', roles: [], permissions: [] }),
    } as unknown as RbacService;
    const tokens = {
      issuePair: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 900 }),
    } as unknown as TokensService;
    const storage = {} as StorageService;
    const events = {} as DomainEventsService;
    return new ProvisioningService(prisma, tenant, storage, events, rbac, tokens);
  };

  it('rejects a non-platform caller', async () => {
    const svc = make({ isPlatform: false });
    await expect(svc.loginAsCommunity('c1', actor, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s an unknown community', async () => {
    const svc = make({ isPlatform: true, community: null });
    await expect(svc.loginAsCommunity('missing', actor, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s when the community has no association admin', async () => {
    const svc = make({ isPlatform: true, community: { id: 'c1', tenantId: 't1', name: 'X' }, admin: null });
    await expect(svc.loginAsCommunity('c1', actor, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mints a token pair for the community admin', async () => {
    const svc = make({
      isPlatform: true,
      community: { id: 'c1', tenantId: 't1', name: 'X' },
      admin: { id: 'a1', email: 'assoc@x', tenantId: 't1' },
    });
    const result = await svc.loginAsCommunity('c1', actor, {});
    expect(result.accessToken).toBe('a');
    expect(result.user.email).toBe('assoc@x');
  });
});
