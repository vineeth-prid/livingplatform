import { getQueueToken } from '@nestjs/bullmq';
import type { TestingModule } from '@nestjs/testing';

import { createPrismaStub } from './common/testing/prisma-stub';
import { NOTIFICATION_DLQ, NOTIFICATION_QUEUE } from './modules/notifications/notification.constants';

/**
 * The same boot smoke test, under `WHATSAPP_PROVIDER=openwa`.
 *
 * This file exists because the default-config suite is blind to a whole class
 * of bug. `onModuleInit` hooks routinely early-return on a provider or feature
 * flag, so a hook that is broken under one configuration does nothing at all
 * under another — and the suite goes green. That is precisely what happened:
 * `WhatsAppSessionService.onModuleInit` touches a Prisma model only when the
 * provider is `openwa`, so the boot test passed everywhere except the
 * deployment configured that way, where it failed *at the deploy gate*.
 *
 * A green run on one configuration is not evidence about another. If a future
 * provider or module flag changes what happens at boot, it belongs here too.
 *
 * Env must be set BEFORE `app.module` is loaded: it calls `ConfigModule.forRoot`
 * at import time, which validates and freezes the configuration. Hence the
 * dynamic import inside `beforeAll` rather than a top-level `import`.
 */
describe('AppModule wiring · WHATSAPP_PROVIDER=openwa', () => {
  jest.setTimeout(60_000);

  let moduleRef: TestingModule;
  const original = { ...process.env };

  beforeAll(async () => {
    process.env.WHATSAPP_PROVIDER = 'openwa';
    process.env.OPENWA_BASE_URL = 'http://localhost:3000';
    process.env.OPENWA_API_KEY = 'test-key';
    // Never let a test dial a real gateway if one happens to be listening.
    process.env.OPENWA_AUTO_RECONNECT = 'false';

    const [{ Test }, { AppModule }, { NotificationProcessor }, { PrismaService }, { RealtimeService }, { RedisService }] =
      await Promise.all([
        import('@nestjs/testing'),
        import('./app.module'),
        import('./modules/notifications/core/notification.processor'),
        import('./modules/prisma/prisma.service'),
        import('./modules/realtime/realtime.service'),
        import('./modules/redis/redis.service'),
      ]);

    const stubQueue = {
      add: jest.fn(),
      close: jest.fn(),
      getJobCounts: jest.fn().mockResolvedValue({}),
    };

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(createPrismaStub())
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn(), get: jest.fn(), set: jest.fn(), del: jest.fn(), quit: jest.fn() })
      .overrideProvider(getQueueToken(NOTIFICATION_QUEUE))
      .useValue(stubQueue)
      .overrideProvider(getQueueToken(NOTIFICATION_DLQ))
      .useValue(stubQueue)
      .overrideProvider(NotificationProcessor)
      .useValue({ worker: { close: jest.fn() } })
      .overrideProvider(RealtimeService)
      .useValue({
        publish: jest.fn(),
        streamFor: jest.fn(),
        userChannel: jest.fn(),
        roomChannel: jest.fn(),
      })
      .compile();

    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef?.close();
    process.env = original;
  });

  /**
   * `moduleRef.init()` runs every `onModuleInit`. The OpenWA-only branches —
   * WhatsAppSessionService ensuring its default session row is the one that
   * broke — execute here and nowhere else in the test suite.
   */
  it('initialises the graph with every OpenWA-only boot hook running', () => {
    expect(moduleRef).toBeDefined();
  });
});
