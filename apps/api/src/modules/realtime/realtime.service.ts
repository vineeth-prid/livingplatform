import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Subject, filter, map, type Observable } from 'rxjs';

import type { AppConfig } from '../../config/configuration';
import type {
  RealtimeAudience,
  RealtimeEvent,
  RealtimeEventTypeName,
} from './realtime.types';

/** An event on the wire, tagged with the channels it should reach. */
interface AddressedEvent {
  channels: string[];
  event: RealtimeEvent;
}

const REDIS_CHANNEL = 'living:realtime';

/**
 * The realtime fan-out hub behind the SSE endpoint.
 *
 * Server → client only, which is why this is Server-Sent Events and not a
 * WebSocket: SSE is plain HTTP, so it inherits the existing bearer-token auth,
 * the existing nginx config and the existing error handling with nothing new to
 * secure. Clients that need to *send* already have REST.
 *
 * Multi-instance correctness: a resident's browser is connected to ONE API
 * instance, and the gate entry that concerns them may be created on ANOTHER.
 * Every publish is therefore mirrored through Redis pub/sub, and each instance
 * re-broadcasts what it receives to its own locally-connected subscribers. With
 * a single instance the Redis hop is a no-op loopback.
 *
 * Redis being down degrades rather than breaks: local subscribers still receive
 * events published on their own instance, and the REST polling fallback in the
 * clients covers the rest.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  /** The in-process bus every local SSE stream reads from. */
  private readonly local$ = new Subject<AddressedEvent>();
  /**
   * Dedicated connections — a subscribed client cannot issue other commands.
   * Created in `onModuleInit`, NOT in the constructor: merely compiling the DI
   * graph (as the boot smoke test does) must not open a socket or leave a
   * reconnect timer behind for Jest to trip over.
   */
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private redisReady = false;
  private readonly redisUrl: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.redisUrl = config.get('redis', { infer: true }).url;
  }

  async onModuleInit(): Promise<void> {
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: null as null,
      // Give up rather than reconnect forever: realtime is an enhancement, and
      // an endless retry loop keeps the process alive at shutdown.
      retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 500, 3000)),
    };
    const subscriber = new Redis(this.redisUrl, options);
    const publisher = new Redis(this.redisUrl, options);
    // ioredis emits 'error' on a dead server; unhandled, that crashes the process.
    subscriber.on('error', () => undefined);
    publisher.on('error', () => undefined);

    try {
      await Promise.all([subscriber.connect(), publisher.connect()]);
      await subscriber.subscribe(REDIS_CHANNEL);
      subscriber.on('message', (_channel, raw) => this.onRedisMessage(raw));
      this.subscriber = subscriber;
      this.publisher = publisher;
      this.redisReady = true;
      this.logger.log('Realtime hub connected (Redis fan-out active)');
    } catch (err) {
      // Single-instance deployments still work; multi-instance loses cross-node
      // delivery until Redis returns. Never fatal at boot.
      subscriber.disconnect();
      publisher.disconnect();
      this.logger.warn(
        `Realtime hub running WITHOUT Redis fan-out — events reach this instance only: ${
          (err as Error).message
        }`,
      );
    }
  }

  onModuleDestroy(): void {
    this.local$.complete();
    this.subscriber?.disconnect();
    this.publisher?.disconnect();
    this.redisReady = false;
  }

  /**
   * Publish an event to an audience. Fire-and-forget by contract: realtime is
   * an enhancement, never the source of truth, so a failure here must not fail
   * the business transaction that triggered it.
   */
  publish<T>(
    type: RealtimeEventTypeName,
    audience: RealtimeAudience,
    payload: T,
  ): void {
    const channels = this.channelsFor(audience);
    if (channels.length === 0) return;

    const addressed: AddressedEvent = {
      channels,
      event: { type, at: new Date().toISOString(), payload },
    };

    // Deliver locally first so a Redis outage never costs same-instance clients.
    this.local$.next(addressed);

    if (this.redisReady && this.publisher) {
      this.publisher
        .publish(REDIS_CHANNEL, JSON.stringify({ ...addressed, origin: this.instanceId }))
        .catch((err: Error) =>
          this.logger.warn(`Realtime fan-out failed: ${err.message}`),
        );
    }
  }

  /** The stream one connected client reads. Filtered to their channels only. */
  streamFor(channels: string[]): Observable<RealtimeEvent> {
    const wanted = new Set(channels);
    return this.local$.pipe(
      filter((addressed) => addressed.channels.some((c) => wanted.has(c))),
      map((addressed) => addressed.event),
    );
  }

  /** Channel name for one user's private stream. */
  userChannel(userId: string): string {
    return `user:${userId}`;
  }

  /** Channel name for a community room (e.g. the gate desk). */
  roomChannel(communityId: string, room: string): string {
    return `room:${communityId}:${room}`;
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Identifies this process so it can ignore the echo of its own publish. */
  private readonly instanceId = `${process.pid}-${Date.now().toString(36)}`;

  private onRedisMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as AddressedEvent & { origin?: string };
      // We already delivered locally at publish time; re-emitting our own
      // message would double-fire every event for same-instance clients.
      if (parsed.origin === this.instanceId) return;
      this.local$.next({ channels: parsed.channels, event: parsed.event });
    } catch (err) {
      this.logger.warn(`Dropped malformed realtime message: ${(err as Error).message}`);
    }
  }

  private channelsFor(audience: RealtimeAudience): string[] {
    const channels: string[] = [];
    for (const userId of audience.userIds ?? []) {
      channels.push(this.userChannel(userId));
    }
    if (audience.communityRoom) {
      channels.push(
        this.roomChannel(audience.communityRoom.communityId, audience.communityRoom.room),
      );
    }
    return channels;
  }
}
