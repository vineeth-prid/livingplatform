import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';

import type { AppConfig } from '../../../../config/configuration';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ChannelHealth,
  DeliveryResult,
  INotificationChannel,
  NotificationMessage,
} from '../../core/notification-channel.interface';

/** What the service worker receives and renders as a system notification. */
interface PushPayload {
  title: string;
  body: string;
  /** Deep link opened when the notification is tapped. */
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
  data?: Record<string, unknown>;
}

/**
 * Web Push channel (VAPID, RFC 8291/8292) — reaches a resident whose app is
 * closed or backgrounded, which the in-app channel by definition cannot.
 *
 * Addressing: `to` is a Living **user id**. One user has many devices, so this
 * channel fans out to every stored subscription for that user and reports
 * success if AT LEAST ONE device accepted the message. A 404/410 from the push
 * service means the browser discarded the subscription, so that row is deleted
 * — this is the only way stale subscriptions ever get cleaned up.
 *
 * Unconfigured is a supported state: with no VAPID keys the channel reports
 * unhealthy and `send` throws a clear error instead of pretending to deliver.
 * Every other channel is unaffected, so a deployment without keys still runs.
 */
@Injectable()
export class PushChannel implements INotificationChannel {
  readonly channel = 'push' as const;
  readonly provider = 'webpush';
  private readonly logger = new Logger(PushChannel.name);
  private readonly ttl: number;
  private readonly configured: boolean;
  /** Set when VAPID was supplied but rejected — surfaced by `health()`. */
  private vapidError: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    const push = config.get('push', { infer: true });
    this.ttl = push.ttl;
    let configured = Boolean(push.publicKey && push.privateKey);

    if (configured) {
      // `setVapidDetails` THROWS on a malformed subject or a wrong-length key —
      // and this runs in a provider constructor, so an unvalidated env var
      // would take the entire API down at boot rather than disabling one
      // channel. Degrade to unconfigured instead: push stops working and says
      // why, everything else keeps running.
      try {
        webpush.setVapidDetails(push.subject, push.publicKey, push.privateKey);
        this.logger.log('Web Push channel ready (VAPID configured)');
      } catch (err) {
        configured = false;
        this.vapidError = (err as Error).message;
        this.logger.error(
          `Web Push DISABLED — the VAPID configuration is invalid: ${this.vapidError}. ` +
            'Check VAPID_SUBJECT is a mailto: or https URL and the keys are a matching pair ' +
            '(npx web-push generate-vapid-keys).',
        );
      }
    }
    this.configured = configured;

    if (!this.configured && !this.vapidError) {
      this.logger.warn(
        'Web Push channel registered but NOT configured — set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to enable it. ' +
          'Gate notifications will still reach residents in-app and, if enabled, by WhatsApp/email.',
      );
    }
  }

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    if (!this.configured) {
      throw new BadRequestException(
        this.vapidError
          ? `Web Push is misconfigured: ${this.vapidError}`
          : 'Web Push is not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are unset)',
      );
    }

    const userIds = (Array.isArray(message.to) ? message.to : [message.to]).filter(Boolean);
    if (userIds.length === 0) {
      throw new BadRequestException('A push notification requires at least one user id');
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });
    if (subscriptions.length === 0) {
      // Not an error the engine should retry — the user simply has no device
      // registered. Retrying would burn the whole backoff budget for nothing.
      throw new BadRequestException('No push devices registered for this recipient');
    }

    const payload = JSON.stringify(this.payloadFor(message));
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: this.ttl, urgency: 'high' },
        ),
      ),
    );

    const gone: string[] = [];
    let delivered = 0;
    results.forEach((result, index) => {
      const sub = subscriptions[index]!;
      if (result.status === 'fulfilled') {
        delivered++;
        return;
      }
      const status = (result.reason as WebPushError)?.statusCode;
      if (status === 404 || status === 410) gone.push(sub.id);
      else {
        this.logger.warn(
          `Push to ${sub.endpoint.slice(0, 48)}… failed (${status ?? 'network'})`,
        );
      }
    });

    if (gone.length > 0) {
      await this.prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
      this.logger.debug(`Pruned ${gone.length} expired push subscription(s)`);
    }

    if (delivered === 0) {
      // Every device failed for a retryable reason — throw so the engine's
      // existing backoff gets its turn.
      throw new Error(`Push delivery failed for all ${subscriptions.length} device(s)`);
    }

    await this.prisma.pushSubscription.updateMany({
      where: { userId: { in: userIds } },
      data: { lastSeenAt: new Date() },
    });

    return {
      messageId: null,
      provider: this.provider,
      channel: this.channel,
      raw: { devices: subscriptions.length, delivered, pruned: gone.length },
    };
  }

  verify(): Promise<boolean> {
    return Promise.resolve(this.configured);
  }

  health(): Promise<ChannelHealth> {
    return Promise.resolve(
      this.configured
        ? { state: 'healthy', channel: this.channel, provider: this.provider }
        : {
            state: 'unhealthy',
            channel: this.channel,
            provider: this.provider,
            // Distinguish "never set up" from "set up wrongly" — the fix is
            // different and this is the screen an admin looks at first.
            reason: this.vapidError
              ? `VAPID configuration is invalid: ${this.vapidError}`
              : 'VAPID keys are not configured',
          },
    );
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  supports(feature: string): boolean {
    return ['background', 'interactive', 'structured'].includes(feature);
  }

  /** Build the service-worker payload from the channel-agnostic message. */
  private payloadFor(message: NotificationMessage): PushPayload {
    const data = message.channelData ?? {};
    return {
      title: message.subject ?? 'Living',
      body: message.text ?? '',
      url: typeof data.url === 'string' ? data.url : undefined,
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      // A gate arrival must not silently disappear from the shade.
      requireInteraction: data.requireInteraction === true,
      actions: Array.isArray(data.actions)
        ? (data.actions as { action: string; title: string }[]).slice(0, 2)
        : undefined,
      data,
    };
  }
}
