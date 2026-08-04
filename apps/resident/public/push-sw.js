/* eslint-disable no-undef */
/**
 * Web Push handlers for the Living resident app.
 *
 * Pulled into the generated service worker via `workbox.importScripts` rather
 * than switching vite-plugin-pwa to injectManifest mode: the existing precache
 * and navigation-fallback behaviour stays exactly as it was, and this file is
 * the only thing that has to be reviewed for push.
 *
 * Kept in plain JS in `public/` so it is copied verbatim — no build step, and
 * no chance of a bundler rewriting service-worker globals.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Living', body: event.data.text() };
  }

  const title = payload.title || 'Living';
  const options = {
    body: payload.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    // `tag` collapses repeat pushes about the SAME delivery into one entry
    // instead of stacking duplicates in the shade.
    tag: payload.tag || 'living',
    renotify: true,
    requireInteraction: payload.requireInteraction === true,
    vibrate: [120, 60, 120],
    data: { url: payload.url || '/', ...(payload.data || {}) },
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const target = data.url || '/';
  // An action button deep-links to the same screen; the decision itself is
  // taken in the app, never from the service worker — approving a delivery is
  // an authenticated call and the SW has no session.
  const url = new URL(target, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an already-open tab rather than piling up new ones.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
