import type { INotificationChannel } from '../core/notification-channel.interface';

/** DI token: the list of all registered notification channels. */
export const NOTIFICATION_CHANNEL_LIST = Symbol('NOTIFICATION_CHANNEL_LIST');

/**
 * The single place that enumerates the available notification channels. Adding a
 * channel (push/sms/…) means constructing it here and adding it to the list —
 * nothing else in the engine changes. Each channel internally owns its own
 * provider factory (EmailProviderFactory, WhatsAppProviderFactory), so provider
 * selection never leaks outside a channel.
 */
export class NotificationChannelFactory {
  static assemble(...channels: INotificationChannel[]): INotificationChannel[] {
    return channels;
  }
}
