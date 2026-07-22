import { useSyncExternalStore } from 'react';
import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

/**
 * Offline readiness for the field app. Three small pieces, no new dependency:
 *
 *  1. `useOnlineStatus()` — reactive navigator.onLine for the offline banner.
 *  2. `persistQueryCache()` — mirrors the Query cache to localStorage so a
 *     worker who opens the app with no signal still sees their last-synced jobs
 *     (the service worker precaches the shell; this precaches the DATA).
 *  3. Queued mutations + retry are handled by TanStack Query itself: mutations
 *     fired offline pause and auto-resume on reconnect, and status changes are
 *     already optimistic (see jobs.ts), so the UI stays responsive offline.
 *
 * ponytail: localStorage snapshot of the whole cache, hydrated once on boot.
 * Swap for @tanstack/query-persist-client + a mutation-resume queue if we need
 * multi-tab sync or durable offline writes — the seam is this one module.
 */

const CACHE_KEY = 'living.workforce.query-cache';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // a day-old job list still beats a blank screen

interface Snapshot {
  savedAt: number;
  state: unknown;
}

/** Rehydrate the cache from the last snapshot (call before the first render). */
export function restoreQueryCache(client: QueryClient): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw) as Snapshot;
    if (Date.now() - snap.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    hydrate(client, snap.state);
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

/** Persist the cache to localStorage on every settled change (debounced). */
export function persistQueryCache(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    try {
      const snap: Snapshot = { savedAt: Date.now(), state: dehydrate(client) };
      localStorage.setItem(CACHE_KEY, JSON.stringify(snap));
    } catch {
      /* quota or serialization issue — cache is best-effort, never fatal */
    }
  };
  return client.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(save, 1000);
  });
}

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** Reactive online/offline state. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
