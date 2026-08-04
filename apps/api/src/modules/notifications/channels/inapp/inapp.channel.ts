import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { RealtimeService } from '../../../realtime/realtime.service';
import { RealtimeEventType } from '../../../realtime/realtime.types';
import type {
  ChannelHealth,
  DeliveryResult,
  INotificationChannel,
  NotificationMessage,
} from '../../core/notification-channel.interface';

/**
 * In-app channel — delivers to an open app over the realtime (SSE) hub.
 *
 * A first-class INotificationChannel like email and WhatsApp, so it inherits
 * the engine's queueing, retry and delivery tracking for free and appears in
 * the notification history and health dashboard alongside the others. The
 * engine core is unchanged; this class only had to be added to the channel list.
 *
 * Addressing: `to` is a Living **user id** (the realtime hub's private channel),
 * not an email or phone. The structured payload the client renders — title,
 * body, action buttons — travels in `channelData`.
 *
 * "Sent" here means *handed to the hub*, not *seen by a human*: if nobody has
 * the app open, the event is dropped by design. That is why a gate entry is
 * ALSO routed to push, and why the entry itself (not this message) is the
 * source of truth a client re-reads on reconnect.
 */
@Injectable()
export class InAppChannel implements INotificationChannel {
  readonly channel = 'inapp' as const;
  readonly provider = 'sse';
  private readonly logger = new Logger(InAppChannel.name);

  constructor(private readonly realtime: RealtimeService) {}

  send(message: NotificationMessage): Promise<DeliveryResult> {
    const userIds = (Array.isArray(message.to) ? message.to : [message.to]).filter(Boolean);
    if (userIds.length === 0) {
      throw new BadRequestException('An in-app notification requires at least one user id');
    }

    const data = message.channelData ?? {};
    const type = (data.realtimeType as typeof RealtimeEventType.GateEntryArrived | undefined)
      ?? RealtimeEventType.GateEntryArrived;

    this.realtime.publish(type, { userIds }, {
      title: message.subject ?? 'Living',
      body: message.text ?? '',
      ...data,
    });

    this.logger.debug(`in-app event ${type} → ${userIds.length} user(s)`);
    return Promise.resolve({
      messageId: null,
      provider: this.provider,
      channel: this.channel,
      raw: { userIds, type },
    });
  }

  /** Nothing to authenticate against — the hub is in-process. */
  verify(): Promise<boolean> {
    return Promise.resolve(true);
  }

  health(): Promise<ChannelHealth> {
    return Promise.resolve({ state: 'healthy', channel: this.channel, provider: this.provider });
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  supports(feature: string): boolean {
    return ['interactive', 'realtime', 'structured'].includes(feature);
  }
}
