import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { NOTIFICATION_CHANNEL_LIST } from '../factories/notification-channel.factory';
import type {
  ChannelHealth, INotificationChannel, NotificationChannelName,
} from './notification-channel.interface';

/**
 * Routes a notification to the right channel implementation. Holds the set of
 * registered channels (assembled by NotificationChannelFactory) and exposes
 * lookup, listing and a health fan-out. Channel-independent — it never knows
 * how any channel actually sends.
 */
@Injectable()
export class ChannelRouter {
  private readonly channels: Map<NotificationChannelName, INotificationChannel>;

  constructor(@Inject(NOTIFICATION_CHANNEL_LIST) channels: INotificationChannel[]) {
    this.channels = new Map(channels.map((c) => [c.channel, c]));
  }

  get(channel: NotificationChannelName): INotificationChannel {
    const c = this.channels.get(channel);
    if (!c) throw new BadRequestException(`No notification channel registered for "${channel}"`);
    return c;
  }

  has(channel: string): channel is NotificationChannelName {
    return this.channels.has(channel as NotificationChannelName);
  }

  list(): INotificationChannel[] {
    return [...this.channels.values()];
  }

  names(): NotificationChannelName[] {
    return [...this.channels.keys()];
  }

  /** Health of every registered channel (for the admin dashboard). */
  health(): Promise<ChannelHealth[]> {
    return Promise.all(this.list().map((c) => c.health()));
  }
}
