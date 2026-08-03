import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from './app.module';
import { ModuleEnabledGuard } from './common/guards/module-enabled.guard';
import { expectSingleton } from './common/testing/di-scope';
import { AmcExpiryService } from './modules/amc/amc-expiry.service';
import { BillingSchedulerService } from './modules/billing/billing-scheduler.service';
import { AnnouncementSchedulerService } from './modules/community-ops/announcement-scheduler.service';
import { MaintenanceSchedulerService } from './modules/maintenance/maintenance-scheduler.service';
import { WhatsAppSessionService } from './modules/notifications/channels/whatsapp/whatsapp-session.service';
import { NotificationProcessor } from './modules/notifications/core/notification.processor';
import { NOTIFICATION_DLQ, NOTIFICATION_QUEUE } from './modules/notifications/notification.constants';
import { PrismaService } from './modules/prisma/prisma.service';
import { RedisService } from './modules/redis/redis.service';

/**
 * Boot smoke test — the check that would have caught the Sprint 12 outage.
 *
 * Unit tests exercise classes in isolation and say nothing about whether Nest
 * can actually WIRE them; `nest build` never instantiates the graph at all. The
 * outage was a dependency *scope* bug — `ModuleEnabledGuard`, a global
 * APP_GUARD, transitively depended on the REQUEST-scoped `TenantContextService`
 * — and every unit test passed with a clean build while the API returned 500 on
 * every request.
 *
 * This compiles the REAL AppModule and asserts that the providers which must be
 * singletons still are: every global guard and every `@Cron` handler.
 *
 * **Runs by default, with no infrastructure.** Postgres and Redis are stubbed
 * at their edges — including the BullMQ Worker, which is the one component that
 * dials Redis eagerly and, left real, both fails without a server and keeps a
 * blocking connection open so Jest never exits. Everything else is the genuine
 * wiring. The trade-off is that the Worker's own dependencies are not asserted
 * here; that code is unchanged since Sprint 11 and covered by its own specs.
 */
describe('AppModule wiring', () => {
  jest.setTimeout(60_000);

  let moduleRef: TestingModule;

  // Compiled ONCE — each compile builds the whole container, so there is no
  // reason to pay for it per assertion.
  beforeAll(async () => {
    const stubQueue = {
      add: jest.fn(),
      close: jest.fn(),
      getJobCounts: jest.fn().mockResolvedValue({}),
    };

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn(), $on: jest.fn() })
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn(), quit: jest.fn() })
      .overrideProvider(getQueueToken(NOTIFICATION_QUEUE))
      .useValue(stubQueue)
      .overrideProvider(getQueueToken(NOTIFICATION_DLQ))
      .useValue(stubQueue)
      // The BullMQ Worker: connects on init and parks on a blocking command.
      .overrideProvider(NotificationProcessor)
      .useValue({ worker: { close: jest.fn() } })
      .compile();

    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('compiles and initialises the whole application graph', () => {
    expect(moduleRef).toBeDefined();
  });

  /**
   * The precise regression. Note that `ModuleEnabledGuard` is registered as
   * `{ provide: APP_GUARD, useClass: ModuleEnabledGuard }`, so it is NOT
   * retrievable with `moduleRef.get(ModuleEnabledGuard)` — and `moduleRef.get`
   * would not detect an inherited scope anyway. `expectSingleton` scans the
   * container by metatype and reads `isDependencyTreeStatic()`; see
   * common/testing/di-scope.ts.
   */
  it('keeps the global module guard a singleton', () => {
    expectSingleton(
      moduleRef,
      ModuleEnabledGuard,
      'it is a global APP_GUARD — a request-scoped one forces Nest to resolve an ' +
        '@Inject(REQUEST) chain on every request in the application.',
    );
  });

  /**
   * Every `@Cron` handler in the app. A request-scoped scheduler is never
   * registered by ScheduleModule — silently, no error, no log — so this class
   * of bug stays invisible until someone notices work stopped happening. That
   * is exactly how the billing sweep went unnoticed from Sprint 11.
   */
  it.each([
    ['billing sweep', BillingSchedulerService],
    ['AMC expiry', AmcExpiryService],
    ['announcement lifecycle', AnnouncementSchedulerService],
    ['preventive maintenance', MaintenanceSchedulerService],
    ['WhatsApp connection watchdog', WhatsAppSessionService],
  ] as Array<[string, abstract new (...args: never[]) => unknown]>)(
    'keeps the %s scheduler a singleton',
    (_label, target) => {
      expectSingleton(
        moduleRef,
        target,
        'ScheduleModule only discovers @Cron on singletons — a request-scoped ' +
          'scheduler is never registered and its job simply never runs.',
      );
    },
  );
});
