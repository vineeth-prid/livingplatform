import { ConfigService } from '@nestjs/config';

import type { PrismaService } from '../prisma/prisma.service';
import { ROLE_KEYS } from '../rbac/rbac.constants';
import { AccountProvisioningService } from './account-provisioning.service';

function makeService(roleExists = true) {
  const prisma = {
    role: {
      findFirst: jest.fn().mockResolvedValue(roleExists ? { id: 'role-security' } : null),
    },
    userRole: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;

  const config = {
    get: () => ({ defaultPassword: 'Living@123' }),
  } as unknown as ConfigService;

  return { service: new AccountProvisioningService(prisma, config as never), prisma };
}

describe('isSecurityJobRole', () => {
  it('matches the SECURITY catalog option, however it is cased or padded', () => {
    for (const value of ['SECURITY', 'security', ' Security ']) {
      expect(AccountProvisioningService.isSecurityJobRole(value)).toBe(true);
    }
  });

  /**
   * Only SECURITY confers gate duty. Mapping FACILITY_MANAGER or ADMIN here
   * would turn a job-title dropdown into a privilege-escalation path.
   */
  it('matches nothing else in the staff role catalog', () => {
    for (const value of [
      'FACILITY_MANAGER', 'SUPERVISOR', 'HOUSEKEEPING',
      'ELECTRICIAN', 'PLUMBER', 'TECHNICIAN', 'ADMIN',
    ]) {
      expect(AccountProvisioningService.isSecurityJobRole(value)).toBe(false);
    }
  });

  it('treats a missing role as not security', () => {
    expect(AccountProvisioningService.isSecurityJobRole(null)).toBe(false);
    expect(AccountProvisioningService.isSecurityJobRole(undefined)).toBe(false);
    expect(AccountProvisioningService.isSecurityJobRole('')).toBe(false);
  });
});

describe('syncSecurityRole', () => {
  it('grants the SECURITY role, scoped to the community', async () => {
    const { service, prisma } = makeService();

    await service.syncSecurityRole('user-1', 'c-1', true, 'admin-1');

    expect(prisma.role.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: null, key: ROLE_KEYS.SECURITY } }),
    );
    expect(prisma.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-1',
          roleId: 'role-security',
          communityId: 'c-1',
        }),
      }),
    );
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });

  /** Moving someone off the gate must actually revoke it. */
  it('revokes the grant when the job title is no longer security', async () => {
    const { service, prisma } = makeService();

    await service.syncSecurityRole('user-1', 'c-1', false, 'admin-1');

    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', roleId: 'role-security', communityId: 'c-1' },
    });
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
  });

  it('is idempotent — re-granting an existing role does not throw', async () => {
    const { service, prisma } = makeService();

    await service.syncSecurityRole('user-1', 'c-1', true, 'admin-1');
    await service.syncSecurityRole('user-1', 'c-1', true, 'admin-1');

    expect(prisma.userRole.upsert).toHaveBeenCalledTimes(2);
  });

  /** Revoking a grant that was never there is a no-op, not an error. */
  it('tolerates revoking when nothing was granted', async () => {
    const { service, prisma } = makeService();
    (prisma.userRole.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(
      service.syncSecurityRole('user-1', 'c-1', false, 'admin-1'),
    ).resolves.toBeUndefined();
  });

  /** A second staff profile sharing one login has no userId of its own. */
  it('does nothing when the staff member has no linked login', async () => {
    const { service, prisma } = makeService();

    await service.syncSecurityRole(null, 'c-1', true, 'admin-1');

    expect(prisma.role.findFirst).not.toHaveBeenCalled();
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
  });

  /** An un-reseeded database must degrade, not take down staff creation. */
  it('warns rather than throwing when the SECURITY role is not seeded', async () => {
    const { service, prisma } = makeService(false);

    await expect(
      service.syncSecurityRole('user-1', 'c-1', true, 'admin-1'),
    ).resolves.toBeUndefined();
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
  });
});
