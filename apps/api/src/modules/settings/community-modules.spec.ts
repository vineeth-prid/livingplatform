import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { CommunityModulesService } from './community-modules.service';

type Row =
  | {
      maintenanceBillingEnabled: boolean;
      servicePackagesEnabled: boolean;
      // Gate Management (Sprint 13) — part of the same features document.
      gateManagementEnabled?: boolean;
      gateApprovalEnabled?: boolean;
      gateSoundEnabled?: boolean;
    }
  | null;

/** The gate half of the features contract, which defaults ON like the rest. */
const GATE_ON = { gateManagement: true, gateApproval: true, gateSound: true };

const prismaWith = (
  row: Row,
  many: Array<{ communityId: string; maintenanceBillingEnabled: boolean }> = [],
) =>
  ({
    communitySettings: {
      findUnique: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue(many),
    },
  }) as unknown as PrismaService;

const makeService = (
  row: Row,
  many?: Array<{ communityId: string; maintenanceBillingEnabled: boolean }>,
) => new CommunityModulesService(prismaWith(row, many));

const BOTH_ON = {
  maintenanceBillingEnabled: true,
  servicePackagesEnabled: true,
  gateManagementEnabled: true,
  gateApprovalEnabled: true,
  gateSoundEnabled: true,
};

describe('CommunityModulesService', () => {
  /**
   * This service is injected into a global APP_GUARD and into a `@Cron`
   * handler, so it must resolve as a singleton — a request-scoped dependency
   * here breaks every request AND silently kills the nightly billing sweep.
   */
  it('resolves as a singleton with no request-scoped dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommunityModulesService,
        { provide: PrismaService, useValue: prismaWith(BOTH_ON) },
      ],
    }).compile();

    expect(() => moduleRef.get(CommunityModulesService)).not.toThrow();
    expect(moduleRef.get(CommunityModulesService)).toBe(moduleRef.get(CommunityModulesService));
  });

  it('reports both modules on when they are enabled', async () => {
    await expect(makeService(BOTH_ON).features('c1')).resolves.toEqual({
      maintenanceBilling: true,
      servicePackages: true,
      ...GATE_ON,
    });
  });

  it('reports maintenance off when disabled', async () => {
    const service = makeService({ maintenanceBillingEnabled: false, servicePackagesEnabled: true });
    await expect(service.isEnabled('c1', 'maintenanceBilling')).resolves.toBe(false);
    await expect(service.isEnabled('c1', 'servicePackages')).resolves.toBe(true);
  });

  /**
   * The non-breaking guarantee: a community that predates this sprint has no
   * settings row, and must keep every module it had.
   */
  it('defaults to ON when the community has no settings row', async () => {
    await expect(makeService(null).features('c1')).resolves.toEqual({
      maintenanceBilling: true,
      servicePackages: true,
      ...GATE_ON,
    });
  });

  it('assert passes when the module is on', async () => {
    await expect(
      makeService(BOTH_ON).assertEnabled('c1', 'maintenanceBilling'),
    ).resolves.toBeUndefined();
  });

  /** 404, not 403 — the endpoints do not exist for that community. */
  it('assert throws NotFound when maintenance billing is off', async () => {
    const service = makeService({ maintenanceBillingEnabled: false, servicePackagesEnabled: true });
    await expect(service.assertEnabled('c1', 'maintenanceBilling')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('assert throws NotFound when packages are off', async () => {
    const service = makeService({ maintenanceBillingEnabled: true, servicePackagesEnabled: false });
    await expect(service.assertEnabled('c1', 'servicePackages')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('maintenanceEnabledByCommunity', () => {
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

    it('does not query at all for an empty id list', async () => {
      const prisma = prismaWith(null);
      const service = new CommunityModulesService(prisma);
      await expect(service.maintenanceEnabledByCommunity([])).resolves.toEqual(new Map());
      expect(prisma.communitySettings.findMany).not.toHaveBeenCalled();
    });
  });
});
