import type { TestingModule } from '@nestjs/testing';

/**
 * Test helper: is a provider's whole dependency tree static (singleton)?
 *
 * Nest propagates `Scope.REQUEST` **upward** — a singleton that depends on a
 * request-scoped provider silently becomes request-scoped itself, and so does
 * everything above it. That matters because two things in this codebase MUST
 * stay singletons or they break in ways nothing else catches:
 *
 *   • a global `APP_GUARD` — a request-scoped one resolves an `@Inject(REQUEST)`
 *     chain on every single request
 *   • a `@Cron` handler — `ScheduleModule` only walks singleton instances, so a
 *     request-scoped scheduler is never registered, with no error and no log
 *
 * `moduleRef.get()` is NOT a reliable probe for this: it throws only for a
 * *directly* request-scoped provider, and returns an instance quite happily for
 * one that inherited the scope. `isDependencyTreeStatic()` is what actually
 * reflects the propagated scope, so that is what these assertions read.
 */
export function isDependencyTreeStatic(
  moduleRef: TestingModule,
  target: abstract new (...args: never[]) => unknown,
): boolean {
  const container = (
    moduleRef as unknown as {
      container: {
        getModules: () => Map<
          string,
          { providers: Map<unknown, { isDependencyTreeStatic?: () => boolean }> }
        >;
      };
    }
  ).container;

  for (const [, mod] of container.getModules()) {
    const wrapper = mod.providers.get(target);
    if (wrapper?.isDependencyTreeStatic) return wrapper.isDependencyTreeStatic();
  }
  throw new Error(`${target.name} was not found in the testing container`);
}

/** Fails with a message that explains the consequence, not just the mismatch. */
export function expectSingleton(
  moduleRef: TestingModule,
  target: abstract new (...args: never[]) => unknown,
  because: string,
): void {
  if (!isDependencyTreeStatic(moduleRef, target)) {
    throw new Error(
      `${target.name} is NOT a singleton — it transitively depends on a ` +
        `request-scoped provider (most likely CommunityAccessService or ` +
        `SettingsService, which reach the REQUEST-scoped TenantContextService).\n` +
        `Why this matters: ${because}`,
    );
  }
}
