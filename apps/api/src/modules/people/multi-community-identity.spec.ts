import { ConfigService } from '@nestjs/config';

import type { PrismaService } from '../prisma/prisma.service';
import { AccountProvisioningService } from './account-provisioning.service';

/**
 * One human, one login — across every community they belong to.
 *
 * Each community is its own tenant here, and provisioning used to REFUSE a
 * phone number it had seen before. That blocked the three ordinary cases the
 * platform exists to serve:
 *
 *   • an owner with flats in two societies
 *   • staff working across several communities
 *   • a resident who moves and keeps their number
 *
 * An admin simply could not add them. The number is now reused and the role is
 * granted against the NEW community, so access follows the grant while the
 * person keeps one identity, one password, and one place to change a number.
 */
function makeService(existingUser: { id: string } | null, opts: { linked?: 'resident' | 'staff' | 'vendor' } = {}) {
  const created: Record<string, unknown>[] = [];
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          where.username && existingUser
            ? {
                ...existingUser,
                tenantId: 't-other',
                residentProfile: opts.linked === 'resident' ? { id: 'r1' } : null,
                staffProfile: opts.linked === 'staff' ? { id: 's1' } : null,
                vendorProfile: opts.linked === 'vendor' ? { id: 'v1' } : null,
              }
            : null,
        ),
      ),
      create: jest.fn().mockResolvedValue({ id: 'user-new' }),
    },
    role: { findFirst: jest.fn().mockResolvedValue({ id: 'role-1' }) },
    userRole: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return Promise.resolve(args.data);
      }),
    },
  } as unknown as PrismaService;

  const config = { get: () => ({ defaultPassword: 'Living@123' }) } as unknown as ConfigService<never, true>;
  return { service: new AccountProvisioningService(prisma, config as never), prisma, grants: created };
}

const input = (kind: 'resident' | 'staff' | 'vendor', communityId: string | null) => ({
  kind,
  tenantId: 't-new',
  communityId,
  phone: '9876543210',
  firstName: 'Aisha',
  lastName: 'Khan',
  actorId: 'admin-1',
});

describe('a phone number already known to the platform', () => {
  it('is no longer refused — the account is reused', async () => {
    const { service } = makeService({ id: 'user-1' }, { linked: 'resident' });

    await expect(service.provisionLogin(input('resident', 'c-2'))).resolves.not.toThrow();
  });

  it('grants the role against the NEW community, which is what carries access', async () => {
    const { service, grants } = makeService({ id: 'user-1' }, { linked: 'resident' });

    await service.provisionLogin(input('resident', 'c-2'));

    expect(grants).toContainEqual(
      expect.objectContaining({ userId: 'user-1', communityId: 'c-2' }),
    );
  });

  it('lets STAFF work in a second community on the same login', async () => {
    const { service, grants } = makeService({ id: 'user-1' }, { linked: 'staff' });

    await service.provisionLogin(input('staff', 'c-2'));

    expect(grants).toContainEqual(expect.objectContaining({ communityId: 'c-2' }));
  });

  it('does not re-grant a role they already hold there', async () => {
    const { service, prisma, grants } = makeService({ id: 'user-1' }, { linked: 'staff' });
    (prisma.userRole.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

    await service.provisionLogin(input('staff', 'c-2'));

    expect(grants).toHaveLength(0);
  });

  it('links the profile only when nothing else claims that slot', async () => {
    // Already linked as staff → the new profile shares the account unlinked.
    const linked = makeService({ id: 'user-1' }, { linked: 'staff' });
    await expect(linked.service.provisionLogin(input('staff', 'c-2'))).resolves.toBeNull();

    // Nothing linked → this profile takes the link.
    const unlinked = makeService({ id: 'user-1' });
    await expect(unlinked.service.provisionLogin(input('staff', 'c-2'))).resolves.toBe('user-1');
  });

  it('still creates a fresh account for a number nobody has used', async () => {
    const { service, prisma } = makeService(null);

    await expect(service.provisionLogin(input('resident', 'c-1'))).resolves.toBe('user-new');
    expect(prisma.user.create).toHaveBeenCalled();
  });
});
