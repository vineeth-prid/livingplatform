import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request tenant context propagated through async work, so the Prisma RLS
 * extension can stamp the tenant GUC on every query without threading it through
 * call sites. Absence of a store (background workers, seeds, public routes) is
 * treated as `bypass` — those are trusted server contexts, not tenant callers.
 */
export interface TenantStore {
  tenantId: string | null;
  /** True for platform admins and non-request contexts — skips tenant scoping. */
  bypass: boolean;
}

export const tenantAls = new AsyncLocalStorage<TenantStore>();

export function getTenantStore(): TenantStore | undefined {
  return tenantAls.getStore();
}
