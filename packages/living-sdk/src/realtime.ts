import type { TokenStore } from './token-store';

export type RealtimeEventTypeName =
  | 'gate.entry.arrived'
  | 'gate.entry.decided'
  | 'gate.entry.updated';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventTypeName;
  at: string;
  payload: T;
}

export interface RealtimeOptions {
  /** Community rooms to join, e.g. ['gate']. Requires the room's permission. */
  rooms?: string[];
  communityId?: string | null;
  onEvent: (event: RealtimeEvent) => void;
  /** Connection state changes — apps use this to show a "live" indicator. */
  onStatus?: (status: 'connecting' | 'open' | 'closed') => void;
}

/** Backoff between reconnects, capped. Index = consecutive failures. */
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000];

/**
 * Client for the API's SSE stream.
 *
 * Uses `fetch` + a streaming reader rather than the browser's `EventSource`,
 * because EventSource cannot send an `Authorization` header — and putting the
 * access token in a query string would leak it into every proxy and access log.
 * This keeps realtime on exactly the same bearer-token auth as every other call.
 *
 * Reconnects with backoff, and gives up silently if the tab goes away. Callers
 * must treat this as an *enhancement*: every screen that uses it also fetches
 * its data normally, so a dropped stream degrades to ordinary polling.
 */
export class RealtimeClient {
  private controller: AbortController | null = null;
  private closed = false;
  private failures = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly tokenStore: TokenStore,
    private readonly options: RealtimeOptions,
  ) {}

  connect(): void {
    this.closed = false;
    void this.run();
  }

  close(): void {
    this.closed = true;
    this.controller?.abort();
    this.controller = null;
    this.options.onStatus?.('closed');
  }

  private async run(): Promise<void> {
    while (!this.closed) {
      try {
        this.options.onStatus?.('connecting');
        await this.stream();
        // A clean end-of-stream (server restart, proxy timeout) is normal —
        // reconnect promptly rather than treating it as a failure.
        this.failures = 0;
      } catch {
        this.failures = Math.min(this.failures + 1, BACKOFF_MS.length - 1);
      }
      if (this.closed) break;
      this.options.onStatus?.('closed');
      await sleep(BACKOFF_MS[this.failures] ?? 30_000);
    }
  }

  private async stream(): Promise<void> {
    const token = this.tokenStore.getAccess();
    if (!token) throw new Error('not authenticated');

    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/realtime/stream`);
    if (this.options.rooms?.length) url.searchParams.set('rooms', this.options.rooms.join(','));
    if (this.options.communityId) url.searchParams.set('communityId', this.options.communityId);

    this.controller = new AbortController();
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal: this.controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);

    this.options.onStatus?.('open');
    this.failures = 0;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!this.closed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. Keep the trailing partial.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) this.handleFrame(frame);
    }
  }

  private handleFrame(frame: string): void {
    const dataLines = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) return;

    try {
      const parsed = JSON.parse(dataLines.join('\n')) as RealtimeEvent;
      // Heartbeats keep the connection warm and carry no `type`.
      if (!parsed?.type) return;
      this.options.onEvent(parsed);
    } catch {
      // A malformed frame is not worth tearing the stream down for.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
