const KEY = 'living.stale-build-reload';

/**
 * Recover a page that is still running a previous deploy.
 *
 * Screens are code-split: each lives in its own hashed file. A deploy replaces
 * those files, so a tab (or installed app) opened before the deploy asks for a
 * file that is gone, and the screen fails to load while Home — already in
 * memory — keeps working. Vite reports that as `vite:preloadError`; a reload
 * fetches the current build. Guarded so a genuinely missing file can never
 * cause a reload loop (at most once a minute).
 */
export function recoverFromStaleBuild(): void {
  if (typeof window === 'undefined') return;
  // An installed app downloads a new deploy in the background, but keeps
  // showing the old screens until relaunched. When the new service worker
  // takes over, reload once so the update shows immediately. (No reload on the
  // very first install — there was no previous worker to replace.)
  const sw = navigator.serviceWorker;
  if (sw?.controller) {
    let reloading = false;
    sw.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }
  window.addEventListener('vite:preloadError', (event) => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) ?? 0);
    } catch {
      /* no storage — still reload once below */
    }
    if (Date.now() - last < 60_000) return; // already tried; let the error boundary show
    event.preventDefault();
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    window.location.reload();
  });
}
