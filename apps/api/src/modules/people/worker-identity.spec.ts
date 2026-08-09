import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS, ROLE_KEYS, SYSTEM_ROLES } from '../rbac/rbac.constants';
import { StaffService } from '../staff/staff.service';
import { VendorService } from '../vendor/vendor.service';

const CALLER: AuthenticatedUser = {
  id: 'user-1',
  email: 'guard@living.local',
  tenantId: 't-1',
  tenantIds: ['t-1'],
  roles: [],
  permissions: [],
};

const permissionsOf = (key: string): string[] => {
  const role = SYSTEM_ROLES.find((r) => r.key === key);
  if (!role) throw new Error(`No system role "${key}"`);
  return role.permissions === '*' ? ['*'] : [...role.permissions];
};

/**
 * The Workforce app has to answer "who am I?" before it can show anyone their
 * work. It used to do that by scanning the community's staff list and the
 * tenant's vendor list for a matching userId — but those endpoints require
 * `staff:read` / `vendor:read`, which STAFF and VENDOR deliberately do not
 * hold. Every worker got "we couldn't match your login to a staff or vendor
 * profile" regardless of how correctly their account was set up.
 *
 * These tests pin BOTH halves: the roles must stay without the register-wide
 * read permission, and the self-scoped endpoints must keep working without it.
 */
describe('Workforce identity resolution', () => {
  it('STAFF cannot read the staff register — so /staff/me must not need it', () => {
    expect(permissionsOf(ROLE_KEYS.STAFF)).not.toContain(PERMISSIONS.STAFF_READ);
  });

  it('VENDOR cannot read the vendor register — so /vendors/me must not need it', () => {
    expect(permissionsOf(ROLE_KEYS.VENDOR)).not.toContain(PERMISSIONS.VENDOR_READ);
  });

  it('SECURITY cannot read the staff register either', () => {
    expect(permissionsOf(ROLE_KEYS.SECURITY)).not.toContain(PERMISSIONS.STAFF_READ);
  });
});

describe('StaffService.findMine', () => {
  const makeService = (rows: unknown[]) => {
    const prisma = {
      staff: { findMany: jest.fn().mockResolvedValue(rows) },
    } as unknown as PrismaService;
    const storage = { resolveUrl: jest.fn().mockReturnValue(null) };
    const service = new StaffService(
      prisma,
      {} as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  };

  it('returns only the caller’s own record, never the register', async () => {
    const { service, prisma } = makeService([
      { id: 'staff-1', userId: 'user-1', communityId: 'c-1', photoKey: null },
    ]);

    const result = await service.findMine(CALLER);

    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', deletedAt: null } }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 'staff-1', communityId: 'c-1' });
  });

  /** An unlinked account is a legitimate state, not an error. */
  it('returns an empty list rather than throwing when nothing is linked', async () => {
    const { service } = makeService([]);
    await expect(service.findMine(CALLER)).resolves.toEqual({ items: [] });
  });
});

describe('VendorService.findMine', () => {
  const makeService = (rows: unknown[]) => {
    const prisma = {
      vendor: { findMany: jest.fn().mockResolvedValue(rows) },
    } as unknown as PrismaService;
    const service = new VendorService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  };

  it('returns only the caller’s own record', async () => {
    const { service, prisma } = makeService([
      { id: 'vendor-1', userId: 'user-1', tenantId: 't-1' },
    ]);

    const result = await service.findMine(CALLER);

    expect(prisma.vendor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', deletedAt: null } }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('returns an empty list rather than throwing when nothing is linked', async () => {
    const { service } = makeService([]);
    await expect(service.findMine(CALLER)).resolves.toEqual({ items: [] });
  });
});
