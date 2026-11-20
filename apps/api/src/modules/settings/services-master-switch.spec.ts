import { Reflector } from '@nestjs/core';

import { ModuleEnabledGuard, RequireCommunityModule } from '../../common/guards/module-enabled.guard';
import { ServiceCatalogService } from '../service-request/service-catalog.service';
import { ServiceRequestService } from '../service-request/service-request.service';
import { CommunityModulesService } from './community-modules.service';

/**
 * The Services master switch sits ABOVE each service's own ON/OFF: while it is
 * off nothing new can start (bookings, catalogue browsing, catalogue edits,
 * package buying), and it never touches the individual settings.
 */
describe('Services master switch', () => {
  const modulesWith = (services: boolean) =>
    new CommunityModulesService({
      communitySettings: {
        findUnique: jest.fn().mockResolvedValue({
          maintenanceBillingEnabled: true, servicePackagesEnabled: true, servicesEnabled: services,
          gateManagementEnabled: true, gateApprovalEnabled: true, gateSoundEnabled: true,
        }),
      },
    } as never);

  it('reports the flag, defaulting ON for communities with no settings row', async () => {
    await expect(modulesWith(false).isEnabled('c1', 'services')).resolves.toBe(false);
    const fresh = new CommunityModulesService({ communitySettings: { findUnique: jest.fn().mockResolvedValue(null) } } as never);
    await expect(fresh.isEnabled('c1', 'services')).resolves.toBe(true);
  });

  it('refuses a new booking (the API, not just the UI)', async () => {
    const svc = new ServiceRequestService(
      { serviceRequest: { create: jest.fn() } } as never,
      { assert: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) } as never,
      {} as never, {} as never, {} as never, { publish: jest.fn() } as never, {} as never, {} as never,
      modulesWith(false),
    );
    await expect(
      svc.create('c1', { serviceId: 's1', unitId: 'u1', title: 'Deep clean', description: 'x' } as never, { id: 'r1', permissions: [] } as never),
    ).rejects.toThrow(/Services are turned off/);
  });

  function catalog(servicesOn: boolean) {
    const prisma = {
      service: { findMany: jest.fn().mockResolvedValue([{ id: 's1', isActive: true, tenantId: null }]), update: jest.fn(), findFirst: jest.fn() },
      community: { findMany: jest.fn().mockResolvedValue([{ id: 'c1' }]) },
      tenantServiceSetting: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    };
    const svc = new ServiceCatalogService(
      prisma as never,
      { isPlatform: false, tenantId: 't1' } as never,
      { assert: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) } as never,
      modulesWith(servicesOn),
    );
    return { svc, prisma };
  }

  it('shows residents no services while off, and refuses catalogue edits without changing any service', async () => {
    const { svc, prisma } = catalog(false);
    await expect(svc.list({ communityId: 'c1', activeOnly: true })).resolves.toEqual([]);
    await expect(svc.setStatus('s1', false)).rejects.toThrow(/turned off/);
    await expect(svc.create({ key: 'x', name: 'X', basePrice: 0 } as never)).rejects.toThrow(/turned off/);
    expect(prisma.service.update).not.toHaveBeenCalled();
    expect(prisma.tenantServiceSetting.upsert).not.toHaveBeenCalled();
  });

  it('lists the catalogue normally when on', async () => {
    const { svc } = catalog(true);
    await expect(svc.list({ communityId: 'c1', activeOnly: true })).resolves.toHaveLength(1);
  });

  it('the route guard checks every module a handler names (package routes need both)', async () => {
    @RequireCommunityModule('servicePackages')
    class Ctl {
      @RequireCommunityModule('servicePackages', 'services')
      buy() {}
    }
    const assertEnabled = jest.fn().mockResolvedValue(undefined);
    const guard = new ModuleEnabledGuard(new Reflector(), { assertEnabled } as never);
    const ctx = {
      getHandler: () => Ctl.prototype.buy,
      getClass: () => Ctl,
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ params: { communityId: 'c1' } }) }),
    };
    await guard.canActivate(ctx as never);
    expect(assertEnabled.mock.calls.map((c) => c[1]).sort()).toEqual(['servicePackages', 'services']);
  });
});
