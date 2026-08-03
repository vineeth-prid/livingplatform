import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { CommunityModulesService } from '../../modules/settings/community-modules.service';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { expectSingleton } from '../testing/di-scope';
import { ModuleEnabledGuard, REQUIRE_MODULE_KEY, type CommunityModule } from './module-enabled.guard';

type SettingsRow = { maintenanceBillingEnabled: boolean; servicePackagesEnabled: boolean } | null;

const prismaWith = (row: SettingsRow) =>
  ({
    communitySettings: { findUnique: jest.fn().mockResolvedValue(row) },
  }) as unknown as PrismaService;

/** An HTTP ExecutionContext carrying route params and route metadata. */
function httpContext(params: Record<string, string> = {}): ExecutionContext {
  const handler = () => undefined;
  const cls = class Controller {};
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ params }) }),
  } as unknown as ExecutionContext;
}

function guardFor(row: SettingsRow, required?: CommunityModule) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  return new ModuleEnabledGuard(reflector, new CommunityModulesService(prismaWith(row)));
}

const BOTH_ON = { maintenanceBillingEnabled: true, servicePackagesEnabled: true };
const BILLING_OFF = { maintenanceBillingEnabled: false, servicePackagesEnabled: true };

describe('ModuleEnabledGuard', () => {
  /**
   * THE regression test for the deploy failure.
   *
   * The guard is a global APP_GUARD, so it is constructed on every request in
   * the app. Injecting anything request-scoped (SettingsService,
   * CommunityAccessService, TenantContextService) makes the guard itself
   * request-scoped, and Nest then has to resolve an `@Inject(REQUEST)` chain for
   * every request — which is what took the API down.
   *
   * `moduleRef.get()` THROWS for a request-scoped provider, so this test fails
   * the moment someone re-introduces one into the guard's dependency graph.
   */
  it('stays a singleton (a request-scoped dependency breaks every request)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ModuleEnabledGuard,
        CommunityModulesService,
        { provide: PrismaService, useValue: prismaWith(BOTH_ON) },
      ],
    }).compile();

    expectSingleton(
      moduleRef,
      ModuleEnabledGuard,
      'this is a global APP_GUARD — a request-scoped one forces Nest to resolve ' +
        'an @Inject(REQUEST) chain on every request in the application.',
    );
  });

  it('allows an ungated route without touching the database', async () => {
    const prisma = prismaWith(BILLING_OFF);
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new ModuleEnabledGuard(reflector, new CommunityModulesService(prisma));

    await expect(guard.canActivate(httpContext({ communityId: 'c1' }))).resolves.toBe(true);
    expect(prisma.communitySettings.findUnique).not.toHaveBeenCalled();
  });

  it('allows a gated route when the module is on', async () => {
    const guard = guardFor(BOTH_ON, 'maintenanceBilling');
    await expect(guard.canActivate(httpContext({ communityId: 'c1' }))).resolves.toBe(true);
  });

  it('refuses with 404 when the module is off', async () => {
    const guard = guardFor(BILLING_OFF, 'maintenanceBilling');
    await expect(guard.canActivate(httpContext({ communityId: 'c1' }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('gates each module independently', async () => {
    const guard = guardFor(BILLING_OFF, 'servicePackages');
    await expect(guard.canActivate(httpContext({ communityId: 'c1' }))).resolves.toBe(true);
  });

  /** A community that predates the toggles keeps every module. */
  it('allows when the community has no settings row', async () => {
    const guard = guardFor(null, 'maintenanceBilling');
    await expect(guard.canActivate(httpContext({ communityId: 'c1' }))).resolves.toBe(true);
  });

  it('allows a gated route that carries no :communityId', async () => {
    const guard = guardFor(BILLING_OFF, 'maintenanceBilling');
    await expect(guard.canActivate(httpContext({}))).resolves.toBe(true);
  });

  /** Cron and event handlers have no HTTP request to read params from. */
  it('allows non-HTTP execution contexts', async () => {
    const guard = guardFor(BILLING_OFF, 'maintenanceBilling');
    const rpcContext = {
      getType: () => 'rpc',
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(rpcContext)).resolves.toBe(true);
  });

  it('reads the metadata from both the handler and the controller class', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new ModuleEnabledGuard(reflector, new CommunityModulesService(prismaWith(BOTH_ON)));
    const context = httpContext();
    await guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
