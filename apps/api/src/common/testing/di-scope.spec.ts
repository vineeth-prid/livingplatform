import { Injectable, Module, Scope } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { expectSingleton, isDependencyTreeStatic } from './di-scope';

@Injectable({ scope: Scope.REQUEST })
class RequestScoped {}

/** Depends on nothing scoped — safe as a global guard or a @Cron handler. */
@Injectable()
class CleanGuard {}

/** Inherits REQUEST scope one level down — the shape of the Sprint 12 outage. */
@Injectable()
class PoisonedGuard {
  constructor(readonly dep: RequestScoped) {}
}

/** Two levels down, which is how the real bug hid (guard → settings → access). */
@Injectable()
class Indirect {
  constructor(readonly dep: RequestScoped) {}
}
@Injectable()
class PoisonedScheduler {
  constructor(readonly dep: Indirect) {}
}

@Injectable()
class NeverRegistered {}

@Module({
  providers: [
    RequestScoped,
    Indirect,
    PoisonedScheduler,
    // Registered exactly as the real guards are — under the enhancer token,
    // NOT under their own class token.
    { provide: APP_GUARD, useClass: CleanGuard },
    { provide: APP_GUARD, useClass: PoisonedGuard },
  ],
})
class FixtureModule {}

/**
 * The helper these assertions rely on has been wrong twice, so it gets its own
 * tests. Both discarded approaches are pinned here as explicit expectations, so
 * nobody reintroduces them believing they work.
 */
describe('di-scope helpers', () => {
  const build = () => Test.createTestingModule({ imports: [FixtureModule] }).compile();

  it('finds a class registered via { provide: APP_GUARD, useClass }', async () => {
    const moduleRef = await build();
    // The whole point: `moduleRef.get(CleanGuard)` cannot see this provider.
    expect(() => moduleRef.get(CleanGuard)).toThrow();
    expect(isDependencyTreeStatic(moduleRef, CleanGuard)).toBe(true);
  });

  it('detects a directly inherited request scope', async () => {
    const moduleRef = await build();
    expect(isDependencyTreeStatic(moduleRef, PoisonedGuard)).toBe(false);
  });

  it('detects a request scope inherited two levels down', async () => {
    const moduleRef = await build();
    expect(isDependencyTreeStatic(moduleRef, PoisonedScheduler)).toBe(false);
  });

  /**
   * Why `moduleRef.get()` is not a usable probe: it resolves a provider that
   * merely INHERITED request scope without complaint, so an assertion built on
   * it passes while the bug is present.
   */
  it('documents why moduleRef.get() is not a scope probe', async () => {
    const moduleRef = await build();
    expect(() => moduleRef.get(PoisonedScheduler)).not.toThrow();
    expect(isDependencyTreeStatic(moduleRef, PoisonedScheduler)).toBe(false);
  });

  it('expectSingleton passes for a clean provider', async () => {
    const moduleRef = await build();
    expect(() => expectSingleton(moduleRef, CleanGuard, 'because')).not.toThrow();
  });

  it('expectSingleton explains the consequence when it fails', async () => {
    const moduleRef = await build();
    expect(() =>
      expectSingleton(moduleRef, PoisonedGuard, 'a global guard must not be request-scoped'),
    ).toThrow(/NOT a singleton[\s\S]*a global guard must not be request-scoped/);
  });

  /** A silently-absent provider would make every assertion vacuously true. */
  it('throws rather than passing when the class is not registered', async () => {
    const moduleRef = await build();
    expect(() => isDependencyTreeStatic(moduleRef, NeverRegistered)).toThrow(
      /was not found in the testing container/,
    );
  });
});
