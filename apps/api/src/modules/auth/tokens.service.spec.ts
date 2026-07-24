import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';

import { TokensService } from './tokens.service';
import type { AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../prisma/prisma.service';
import type { RbacService } from '../rbac/rbac.service';

// Keep the crypto fast + deterministic; we assert on wiring, not hashing.
jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn().mockResolvedValue('hashed'),
  verify: jest.fn().mockResolvedValue(true),
}));

const principal: AuthenticatedUser = {
  id: 'u1', email: 'admin@community.test', tenantId: 't1', roles: [], permissions: [],
};

function setup() {
  const created = { id: 'row-new' };
  const refreshToken = {
    create: jest.fn().mockResolvedValue(created),
    update: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn(),
  };
  const prisma = { refreshToken } as unknown as PrismaService;
  const signed: { payload?: Record<string, unknown> } = {};
  const jwt = {
    signAsync: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
      signed.payload = payload;
      return Promise.resolve('access.jwt');
    }),
  } as unknown as JwtService;
  const rbac = { buildPrincipal: jest.fn().mockResolvedValue(principal) } as unknown as RbacService;
  const config = {
    get: () => ({ accessSecret: 's', accessTtl: '15m', refreshTtl: '7d', refreshTtlRemember: '30d' }),
  } as unknown as ConfigService<AppConfig, true>;
  return { service: new TokensService(prisma, jwt, rbac, config), refreshToken, signed };
}

describe('TokensService impersonation attribution', () => {
  it('embeds the operator in the access token and persists it on the refresh row', async () => {
    const { service, refreshToken, signed } = setup();
    const pair = await service.issuePair(principal, false, {}, { id: 'p1', email: 'platform@op.test' });

    expect(signed.payload!.impersonatedBy).toEqual({ id: 'p1', email: 'platform@op.test' });
    expect(refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ impersonatorId: 'p1', impersonatorEmail: 'platform@op.test' }),
      }),
    );
    expect(pair.refreshToken.startsWith('row-new.')).toBe(true);
  });

  it('does NOT stamp an operator on an ordinary (non-impersonated) session', async () => {
    const { service, refreshToken, signed } = setup();
    await service.issuePair(principal, false, {});
    expect(signed.payload!.impersonatedBy).toBeUndefined();
    expect(refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ impersonatorId: null, impersonatorEmail: null }) }),
    );
  });

  it('preserves the operator across refresh/rotation', async () => {
    const { service, refreshToken, signed } = setup();
    refreshToken.findUnique.mockResolvedValue({
      id: 'row-old', familyId: 'fam', revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000), tokenHash: 'hashed',
      impersonatorId: 'p1', impersonatorEmail: 'platform@op.test',
      user: { id: 'u1', email: 'admin@community.test', tenantId: 't1', status: 'ACTIVE', deletedAt: null },
    });

    await service.rotate('row-old.secret', false, {});

    // New access token still carries the operator …
    expect(signed.payload!.impersonatedBy).toEqual({ id: 'p1', email: 'platform@op.test' });
    // … and the replacement refresh row re-persists it.
    expect(refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ impersonatorId: 'p1', impersonatorEmail: 'platform@op.test' }),
      }),
    );
  });
});
