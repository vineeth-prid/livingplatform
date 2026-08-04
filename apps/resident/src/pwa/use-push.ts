import { useCallback, useEffect, useState } from 'react';

import { living } from '../lib/living';

export type PushState =
  /** This device is registered to receive gate notifications. */
  | 'subscribed'
  /** Supported and permitted, just not registered yet. */
  | 'available'
  /** The user said no. Only they can undo it, in browser settings. */
  | 'denied'
  /** The server has no VAPID keys — push is off for this deployment. */
  | 'unconfigured'
  /** No service worker / PushManager (e.g. iOS Safari before 16.4). */
  | 'unsupported'
  | 'loading';

export interface PushControls {
  state: PushState;
  /** Ask permission and register this device. Resolves to whether it worked. */
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
  busy: boolean;
}

/**
 * Web Push registration for this device.
 *
 * Deliberately explicit rather than automatic: browsers permanently blacklist a
 * site that asks for notification permission unprompted, so the request only
 * ever happens from the resident tapping the toggle in Profile.
 */
export function usePush(): PushControls {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!supported()) {
      setState('unsupported');
      return;
    }
    try {
      const { enabled } = await living.push.publicKey();
      if (!enabled) {
        setState('unconfigured');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? 'subscribed' : 'available');
    } catch {
      setState('unsupported');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const { publicKey, enabled } = await living.push.publicKey();
      if (!enabled || !publicKey) {
        setState('unconfigured');
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'available');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      // Reuse an existing subscription if the browser already has one — calling
      // subscribe() twice with a different key throws.
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) throw new Error('incomplete subscription');

      await living.push.subscribe({
        endpoint: subscription.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      setState('subscribed');
      return true;
    } catch {
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Tell the server first: if the browser unsubscribe succeeds but the
        // API call fails, we would keep pushing to a dead endpoint.
        await living.push.unsubscribe(subscription.endpoint).catch(() => undefined);
        await subscription.unsubscribe();
      }
      setState('available');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, subscribe, unsubscribe, busy };
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * VAPID keys travel as base64url; `PushManager.subscribe` wants raw bytes.
 * Exported for its unit test — the padding maths is the kind of thing that
 * silently produces an "invalid applicationServerKey" at 3am.
 */
export function urlBase64ToUint8Array(base64UrlKey: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64UrlKey.length % 4)) % 4);
  const base64 = (base64UrlKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // Backed by a plain ArrayBuffer (not SharedArrayBuffer) so it satisfies
  // BufferSource for `applicationServerKey`.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
