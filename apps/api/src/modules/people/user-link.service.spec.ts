import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { UserLinkService } from './user-link.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The Sprint 3 invariant: a platform User maps to AT MOST ONE people profile,
 * across residents/vendors/staff, and only within its own tenant.
 */
describe('UserLinkService', () => {
  const build = (opts: {
    user: { id: string; tenantId: string | null } | null;
    resident?: { id: string } | null;
    vendor?: { id: string } | null;
    staff?: { id: string } | null;
  }) => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(opts.user) },
      resident: { findFirst: jest.fn().mockResolvedValue(opts.resident ?? null) },
      vendor: { findFirst: jest.fn().mockResolvedValue(opts.vendor ?? null) },
      staff: { findFirst: jest.fn().mockResolvedValue(opts.staff ?? null) },
    } as unknown as PrismaService;
    return new UserLinkService(prisma);
  };

  it('allows an unlinked user in the same tenant', async () => {
    const svc = build({ user: { id: 'u1', tenantId: 't1' } });
    await expect(svc.assertLinkable('u1', 't1')).resolves.toBeUndefined();
  });

  it('rejects a missing user', async () => {
    const svc = build({ user: null });
    await expect(svc.assertLinkable('u1', 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a user from a different tenant', async () => {
    const svc = build({ user: { id: 'u1', tenantId: 't2' } });
    await expect(svc.assertLinkable('u1', 't1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a user already linked to another profile (vendor)', async () => {
    const svc = build({
      user: { id: 'u1', tenantId: 't1' },
      vendor: { id: 'v1' },
    });
    await expect(svc.assertLinkable('u1', 't1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows re-saving the same profile via exclude', async () => {
    // The staff row that matches is the one being updated → excluded.
    const svc = build({
      user: { id: 'u1', tenantId: 't1' },
      staff: null, // findFirst with `id: { not }` returns nothing
    });
    await expect(
      svc.assertLinkable('u1', 't1', { kind: 'staff', id: 's1' }),
    ).resolves.toBeUndefined();
  });
});
