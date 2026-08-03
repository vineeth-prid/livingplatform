import { NotFoundException } from '@nestjs/common';

import type { DomainEventsService } from '../events/domain-events.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CommunityAccessService } from '../tenancy/community-access.service';
import { SettingsService } from './settings.service';

type Row = { maintenanceBillingEnabled: boolean; servicePackagesEnabled: boolean } | null;

const makeService = (row: Row, many: Array<{ communityId: string; maintenanceBillingEnabled: boolean }> = []) => {
  const prisma = {
    communitySettings: {
      findUnique: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue(many),
    },
  } as unknown as PrismaService;
  return new SettingsService(
    prisma,
    {} as CommunityAccessService,
    {} as DomainEventsService,
  );
};

describe('SettingsService module toggles', () => {
  it('reports both modules on when they are enabled', async () => {
    const service = makeService({ maintenanceBillingEnabled: true, servicePackagesEnabled: true });
    await expect(service.features('c1')).resolves.toEqual({
      maintenanceBilling: true,
      servicePackages: true,
    });
  });

  it('reports maintenance off when disabled', async () => {
    const service = makeService({ maintenanceBillingEnabled: false, servicePackagesEnabled: true });
    await expect(service.isMaintenanceBillingEnabled('c1')).resolves.toBe(false);
  });

  /**
   * The non-breaking guarantee: a community that predates this sprint has no
   * settings row, and must keep every module it had.
   */
  it('defaults to ON when the community has no settings row', async () => {
    const service = makeService(null);
    await expect(service.features('c1')).resolves.toEqual({
      maintenanceBilling: true,
      servicePackages: true,
    });
  });

  it('assert passes when maintenance billing is on', async () => {
    const service = makeService({ maintenanceBillingEnabled: true, servicePackagesEnabled: true });
    await expect(service.assertMaintenanceBillingEnabled('c1')).resolves.toBeUndefined();
  });

  /** 404, not 403 — the endpoints do not exist for that community. */
  it('assert throws NotFound when maintenance billing is off', async () => {
    const service = makeService({ maintenanceBillingEnabled: false, servicePackagesEnabled: true });
    await expect(service.assertMaintenanceBillingEnabled('c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('assert throws NotFound when packages are off', async () => {
    const service = makeService({ maintenanceBillingEnabled: true, servicePackagesEnabled: false });
    await expect(service.assertServicePackagesEnabled('c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SettingsService.maintenanceEnabledByCommunity', () => {
  it('answers for every requested community, defaulting the missing ones to on', async () => {
    const service = makeService(null, [
      { communityId: 'a', maintenanceBillingEnabled: false },
      { communityId: 'b', maintenanceBillingEnabled: true },
    ]);
    const result = await service.maintenanceEnabledByCommunity(['a', 'b', 'never-configured']);
    expect(result.get('a')).toBe(false);
    expect(result.get('b')).toBe(true);
    expect(result.get('never-configured')).toBe(true);
    expect(result.size).toBe(3);
  });
});
