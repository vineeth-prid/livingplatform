import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationEvent } from '@prisma/client';

import type { AppConfig } from '../../config/configuration';
import { DomainEventName, type GateEntryEvent } from '../events/domain-events';
import { NotificationDispatcher } from '../notifications/core/notification.dispatcher';
import { RecipientResolver } from '../notifications/core/recipient-resolver';
import type { NotificationChannelName } from '../notifications/core/notification-channel.interface';
import { NOTIFICATION_TEMPLATES } from '../notifications/notification.constants';
import { NotificationPreferenceService } from '../notifications/preferences/notification-preference.service';
import { RealtimeEventType } from '../realtime/realtime.types';
import { PrismaService } from '../prisma/prisma.service';
import { GateEntryService } from './gate-entry.service';

/**
 * The seam between Gate Management and the Notification Engine.
 *
 * Gate Management knows nothing about channels or providers; it publishes a
 * domain event. This listener translates that event into ONE dispatch per
 * channel the community has enabled, through the engine's published interfaces
 * (`NotificationPreferenceService` → `RecipientResolver` → `NotificationDispatcher`).
 * No provider is ever invoked directly and no notification logic is duplicated.
 *
 * It lives in the gate module rather than in the engine's router because it
 * needs to write the outcome back onto the gate entry (NOTIFIED vs failed) —
 * which is gate business logic, not routing.
 */
@Injectable()
export class GateNotificationListener {
  private readonly logger = new Logger(GateNotificationListener.name);
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly preferences: NotificationPreferenceService,
    private readonly recipients: RecipientResolver,
    private readonly entries: GateEntryService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.webAppUrl = config.get('webAppUrl', { infer: true });
  }

  /**
   * A delivery (or any gate arrival) has been recorded — tell the resident.
   *
   * Bound to the GENERIC created event so visitor/service-personnel/vehicle
   * entries are covered the moment they are switched on. Every failure is
   * swallowed and recorded on the entry: a notification problem must never
   * fail, or roll back, the guard's write.
   */
  @OnEvent(DomainEventName.GateEntryCreated, { async: true })
  async onGateEntryCreated(event: GateEntryEvent): Promise<void> {
    try {
      await this.notifyResident(event);
    } catch (err) {
      this.logger.error(
        `Gate notification failed for ${event.data.entryNumber}`,
        err as Error,
      );
      await this.entries
        .markNotified(event.entityId, { channels: [], failed: true })
        .catch(() => undefined);
    }
  }

  private async notifyResident(event: GateEntryEvent): Promise<void> {
    const { communityId } = event;
    if (!event.data.residentId || !communityId) {
      // Nobody to tell — an unoccupied unit. The entry stands as a log record.
      await this.entries.markNotified(event.entityId, { channels: [], failed: true });
      return;
    }

    const routing = await this.preferences.resolve(
      communityId,
      NotificationEvent.GATE_ENTRY_ARRIVED,
    );
    if (!routing.enabled) {
      await this.entries.markNotified(event.entityId, { channels: [], failed: true });
      return;
    }

    const entry = await this.prisma.gateEntry.findUnique({
      where: { id: event.entityId },
      select: {
        id: true, entryNumber: true, personName: true, vendorName: true,
        deliveryType: true, mobileNumber: true, createdAt: true,
        gate: { select: { name: true } },
      },
    });
    if (!entry) return;

    const unit = await this.prisma.unit.findUnique({
      where: { id: event.data.unitId },
      select: { unitNumber: true },
    });

    const gateName = entry.gate?.name ?? 'Main Gate';
    const variables = {
      residentName: '',
      gateName,
      vendorName: entry.vendorName ?? 'A delivery',
      personName: entry.personName,
      deliveryType: entry.deliveryType ?? null,
      mobileNumber: entry.mobileNumber ?? null,
      unitNumber: unit?.unitNumber ?? '',
      entryNumber: entry.entryNumber,
      arrivedAt: entry.createdAt.toLocaleString(),
      actionUrl: `${this.webAppUrl}/gate/${entry.id}`,
    };

    const ref = { residentId: event.data.residentId, communityId };
    const delivered: string[] = [];

    for (const channel of routing.channels) {
      const address = await this.recipients.resolve(channel, ref);
      if (!address) continue;
      try {
        await this.dispatch(channel, address, variables, entry.id, event, gateName);
        delivered.push(channel);
      } catch (err) {
        // One channel failing (no push device, WhatsApp down) must not stop the
        // others — reaching the resident ANY way is what matters.
        this.logger.warn(
          `Gate notification on "${channel}" failed for ${entry.entryNumber}: ${
            (err as Error).message
          }`,
        );
      }
    }

    await this.entries.markNotified(event.entityId, {
      channels: delivered,
      failed: delivered.length === 0,
    });
  }

  /** One dispatch, shaped for the channel. All go through the engine. */
  private dispatch(
    channel: NotificationChannelName,
    address: string,
    variables: Record<string, unknown>,
    entryId: string,
    event: GateEntryEvent,
    gateName: string,
  ): Promise<unknown> {
    const ctx = {
      tenantId: event.tenantId,
      communityId: event.communityId,
      metadata: { domainEvent: event.name, entityId: entryId },
    };

    // Realtime and push carry a structured payload the client renders as a
    // popup / system notification, so they bypass HTML templating.
    if (channel === 'inapp' || channel === 'push') {
      const title = `Delivery at ${gateName}`;
      const body = `${variables.vendorName as string} — ${variables.personName as string} is at the gate for ${variables.unitNumber as string}.`;
      return this.dispatcher.dispatch(
        {
          channel,
          to: address,
          subject: title,
          text: body,
          priority: 'high',
          channelData: {
            realtimeType: RealtimeEventType.GateEntryArrived,
            entryId,
            entryNumber: variables.entryNumber,
            url: `/gate/${entryId}`,
            tag: `gate-${entryId}`,
            requireInteraction: true,
            actions: [
              { action: 'approve', title: 'Approve' },
              { action: 'reject', title: 'Reject' },
            ],
            // Everything the popup needs without a follow-up fetch.
            vendorName: variables.vendorName,
            personName: variables.personName,
            unitNumber: variables.unitNumber,
            gateName,
            mobileNumber: variables.mobileNumber,
            deliveryType: variables.deliveryType,
          },
        },
        ctx,
      );
    }

    return this.dispatcher.dispatchTemplate(
      channel,
      NOTIFICATION_TEMPLATES.GATE_ENTRY_ARRIVED,
      address,
      variables,
      { ctx },
    );
  }
}
