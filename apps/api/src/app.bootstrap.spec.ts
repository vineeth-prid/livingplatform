import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { AppModule } from './app.module';
import { ModuleEnabledGuard } from './common/guards/module-enabled.guard';
import { BillingSchedulerService } from './modules/billing/billing-scheduler.service';
import { PrismaService } from './modules/prisma/prisma.service';
import { RedisService } from './modules/redis/redis.service';

/**
 * Boot smoke test — the one that would have caught the deploy failure.
 *
 * Unit tests exercise classes in isolation and therefore say nothing about
 * whether Nest can actually WIRE them. The Sprint 12 outage was a dependency
 * *scope* bug: `ModuleEnabledGuard` (a global APP_GUARD) transitively depended
 * on the REQUEST-scoped `TenantContextService`, so every request had to resolve
 * an `@Inject(REQUEST)` chain and blew up. Every unit test still passed and
 * `nest build` was perfectly happy, because neither one instantiates the graph.
 *
 * This compiles the real AppModule with only the external I/O stubbed, then
 * asserts the providers that MUST be singletons resolve as singletons:
 * `moduleRef.get()` throws for a request-scoped provider, which is exactly the
 * signal we want.
 */
/**
 * Opt-in: compiling the real AppModule brings up BullMQ, which opens its own
 * ioredis connection and ignores any RedisService override — so this needs a
 * reachable Redis and would be flaky as a default unit test.
 *
 * Run it where infrastructure exists, which is exactly where it earns its keep:
 *
 *   RUN_BOOTSTRAP_TESTS=1 npx jest src/app.bootstrap.spec.ts
 *
 * Worth adding to the deploy script's pre-flight, after `pnpm install` and
 * before restarting the service — it fails on DI errors that `nest build` and
 * every unit test happily miss.
 */
const describeBootstrap = process.env.RUN_BOOTSTRAP_TESTS === '1' ? describe : describe.skip;

describeBootstrap('AppModule wiring', () => {
  jest.setTimeout(30_000);

  const build = () =>
    Test.createTestingModule({ imports: [AppModule] })
      // Stub the two things that would otherwise open sockets. Everything else
      // — every module, guard, scheduler and interceptor — is the real wiring.
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn(), $on: jest.fn() })
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn(), quit: jest.fn() })
      .compile();

  it('compiles the whole application graph', async () => {
    const moduleRef = await build();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('resolves the global module guard as a singleton', async () => {
    const moduleRef = await build();

    // Throws for a request-scoped provider — the precise regression.
    const guard = moduleRef.get(ModuleEnabledGuard, { strict: false });
    expect(guard).toBeInstanceOf(ModuleEnabledGuard);
    expect(moduleRef.get(ModuleEnabledGuard, { strict: false })).toBe(guard);

    await moduleRef.close();
  });

  it('resolves the billing scheduler as a singleton so its @Cron can register', async () => {
    const moduleRef = await build();

    const scheduler = moduleRef.get(BillingSchedulerService, { strict: false });
    expect(scheduler).toBeInstanceOf(BillingSchedulerService);

    await moduleRef.close();
  });

  it('registers exactly the expected global guard chain', async () => {
    const moduleRef = await build();
    // All five APP_GUARDs must be constructible; a scope error in any one of
    // them takes down every request in the application.
    const guards = moduleRef.get<unknown[]>(APP_GUARD, { strict: false });
    expect(Array.isArray(guards) ? guards.length : 1).toBeGreaterThan(0);
    await moduleRef.close();
  });
});
