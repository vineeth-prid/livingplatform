import { useEffect, useRef, useState } from 'react';
import { RealtimeClient, type RealtimeEvent } from '@living/living-sdk';

import { useLiving } from './sdk-context';
import { useAuth } from './auth';

export type RealtimeStatus = 'connecting' | 'open' | 'closed';

export interface UseRealtimeOptions {
  /** Community rooms to join, e.g. ['gate']. Omit for the private user stream. */
  rooms?: string[];
  communityId?: string | null;
  /** Set false to stay disconnected (e.g. the screen is not mounted). */
  enabled?: boolean;
  onEvent: (event: RealtimeEvent) => void;
}

/**
 * Subscribe to the API's realtime stream for as long as the component is
 * mounted.
 *
 * Shared here rather than written per app because all three apps need the same
 * two guarantees: exactly ONE connection per mount (a duplicated stream means
 * duplicated popups), and a handler that can change every render without
 * tearing the connection down — hence the ref indirection below.
 *
 * Treat this as an enhancement. Every caller must also load its data normally,
 * so a closed stream degrades to whatever refetching the screen already does.
 */
export function useRealtime({
  rooms,
  communityId,
  enabled = true,
  onEvent,
}: UseRealtimeOptions): RealtimeStatus {
  const living = useLiving();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<RealtimeStatus>('closed');

  // The latest handler, without it being a dependency of the effect: putting
  // `onEvent` in the deps would reconnect on every parent render.
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const roomKey = rooms?.join(',') ?? '';

  useEffect(() => {
    if (!enabled || !isAuthenticated) {
      setStatus('closed');
      return;
    }
    // A room subscription without a community would be rejected by the server.
    if (roomKey && !communityId) return;

    const client = new RealtimeClient(living.http.apiBaseUrl, living.tokenStore, {
      rooms: roomKey ? roomKey.split(',') : undefined,
      communityId,
      onEvent: (event) => handler.current(event),
      onStatus: setStatus,
    });
    client.connect();
    return () => client.close();
  }, [living, enabled, isAuthenticated, roomKey, communityId]);

  return status;
}
