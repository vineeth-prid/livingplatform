import type { TestingModule } from '@nestjs/testing';

type AnyClass = abstract new (...args: never[]) => unknown;

interface InstanceWrapperLike {
  metatype?: unknown;
  isDependencyTreeStatic?: () => boolean;
}

interface ContainerLike {
  getModules: () => Map<string, { providers: Map<unknown, InstanceWrapperLike> }>;
}

/**
 * Test helpers for provider SCOPE.
 *
 * Nest propagates `Scope.REQUEST` **upward** — a singleton that depends on a
 * request-scoped provider silently becomes request-scoped itself, and so does
 * everything above it. Two things in this codebase must never inherit that:
 *
 *   • a global `APP_GUARD` — a request-scoped one resolves an `@Inject(REQUEST)`
 *     chain on every single request (this took the API down after Sprint 12)
 *   • a `@Cron` handler — `ScheduleModule` only walks singleton instances, so a
 *     request-scoped scheduler is never registered, with no error and no log
 *
 * Two probes that DON'T work, both learned the hard way:
 *
 *   1. `moduleRef.get(Cls)` throws only for a *directly* request-scoped
 *      provider. For one that merely INHERITED the scope it returns an instance
 *      quite happily, so an assertion built on it passes with the bug present.
 *   2. `moduleRef.get(Cls)` also cannot find a provider registered as
 *      `{ provide: APP_GUARD, useClass: Cls }` — that lives under the enhancer
 *      token, not under `Cls`. Nor can you fetch APP_GUARD itself: Nest gives
 *      each enhancer registration its own generated token.
 *
 * `isDependencyTreeStatic()` does reflect the propagated scope, and scanning
 * wrappers by **metatype** finds a class however it was registered. That is
 * what these helpers do.
 */
function findWrappers(moduleRef: TestingModule, target: AnyClass): InstanceWrapperLike[] {
  const container = (moduleRef as unknown as { container: ContainerLike }).container;
  const found: InstanceWrapperLike[] = [];

  for (const [, mod] of container.getModules()) {
    for (const [token, wrapper] of mod.providers) {
      // Matches a plain class provider (token === class) and a custom provider
      // such as { provide: APP_GUARD, useClass: target } (metatype === class).
      if (token === target || wrapper.metatype === target) found.push(wrapper);
    }
  }
  return found;
}

/**
 * Is every registration of `target` backed by a fully static dependency tree?
 * Throws when the class is not registered at all — a silently-absent provider
 * would make any assertion below vacuously true.
 */
export function isDependencyTreeStatic(moduleRef: TestingModule, target: AnyClass): boolean {
  const wrappers = findWrappers(moduleRef, target);
  if (wrappers.length === 0) {
    throw new Error(
      `${target.name} was not found in the testing container — check it is registered ` +
        `(directly, or via { provide: <TOKEN>, useClass: ${target.name} }).`,
    );
  }
  return wrappers.every((w) => w.isDependencyTreeStatic?.() ?? true);
}

/** Fails with a message that explains the consequence, not just the mismatch. */
export function expectSingleton(
  moduleRef: TestingModule,
  target: AnyClass,
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
