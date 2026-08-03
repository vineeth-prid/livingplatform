import { ConfigService } from '@nestjs/config';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';

import { expectSingleton, isDependencyTreeStatic } from '../../common/testing/di-scope';
import { DomainEventsService } from '../events/domain-events.service';
import { NotificationRouterService } from '../notifications/core/notification-router.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityModulesService } from '../settings/community-modules.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { BillingSchedulerService } from './billing-scheduler.service';
import { InvoiceService } from './invoice.service';

/**
 * `ScheduleModule` discovers `@Cron` handlers by walking SINGLETON provider
 * instances. If any dependency is request-scoped, Nest makes this service
 * request-scoped too and the cron handler is **silently never registered** —
 * no error, no log, the nightly sweep simply never runs and late fees quietly
 * stop being applied.
 *
 * `InvoiceService` is genuinely request-scoped (it reaches
 * `CommunityAccessService` → the REQUEST-scoped `TenantContextService`), so the
 * scheduler resolves it per run via ModuleRef instead of injecting it.
 *
 * The test module therefore registers the **real** `InvoiceService` and its
 * real scoped chain. That matters: an earlier version of this file stubbed it
 * with `useValue`, which is a singleton, so the "is it a singleton?" assertion
 * passed even with the bug present. `assertsRealScope` below pins that down.
 */
describe('BillingSchedulerService wiring', () => {
  const communities = [{ id: 'c1' }, { id: 'c2' }];
  let findMany: jest.Mock;

  const build = async (): Promise<TestingModule> => {
    findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      community: { findMany: jest.fn().mockResolvedValue(communities) },
      // Read by InvoiceService.refreshOverdue and by dueSoon().
      maintenanceInvoice: { findMany },
      communitySettings: {
        findMany: jest.fn().mockResolvedValue([
          { communityId: 'c1', maintenanceBillingEnabled: true },
          { communityId: 'c2', maintenanceBillingEnabled: false },
        ]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;

    return Test.createTestingModule({
      providers: [
        BillingSchedulerService,
        CommunityModulesService,
        // Real, and therefore really request-scoped.
        InvoiceService,
        CommunityAccessService,
        TenantContextService,
        { provide: 'REQUEST', useValue: {} },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: () => ({ invoicePrefix: 'INV', defaultDueDay: 10, currency: 'INR' }) },
        },
        { provide: DomainEventsService, useValue: { publish: jest.fn(), from: () => ({}) } },
        // Behaviour lives in its own spec; the singleton guarantee is carried
        // by the real InvoiceService above.
        { provide: NotificationRouterService, useValue: { sendMaintenanceDue: jest.fn().mockResolvedValue(0) } },
      ],
    }).compile();
  };

  /**
   * Pins the premise: if InvoiceService ever stops being request-scoped, this
   * file silently stops testing anything, so fail loudly instead.
   */
  it('premise: InvoiceService really is request-scoped', async () => {
    const moduleRef = await build();
    expect(isDependencyTreeStatic(moduleRef, InvoiceService)).toBe(false);
  });

  it('stays a singleton, so its @Cron handler can be registered', async () => {
    const moduleRef = await build();
    expectSingleton(
      moduleRef,
      BillingSchedulerService,
      'ScheduleModule only discovers @Cron on singletons — a request-scoped ' +
        'scheduler is never registered and the nightly billing sweep never runs.',
    );
  });

  it('sweeps only communities that collect maintenance through Living', async () => {
    const moduleRef = await build();
    const scheduler = moduleRef.get(BillingSchedulerService);

    const result = await scheduler.sweep();

    // c2 has the module off — it must never be swept.
    expect(result.communities).toBe(1);
    // One refreshOverdue pass, and it read invoices for c1 only.
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ communityId: 'c1' });
  });

  /**
   * Guards the ModuleRef pattern itself: cron runs with no HTTP request, so a
   * DI context has to be registered by hand or `resolve()` throws.
   */
  it('resolves request-scoped collaborators outside an HTTP request', async () => {
    const moduleRef = await build();
    const ref = moduleRef.get(ModuleRef);
    const contextId = ContextIdFactory.create();
    ref.registerRequestByContextId({}, contextId);

    await expect(
      ref.resolve(InvoiceService, contextId, { strict: false }),
    ).resolves.toBeInstanceOf(InvoiceService);
  });
});
