import { NotificationEvent } from '@prisma/client';

import { DomainEventName, type GateEntryEvent } from '../events/domain-events';
import type { NotificationDispatcher } from '../notifications/core/notification.dispatcher';
import type { RecipientResolver } from '../notifications/core/recipient-resolver';
import type { NotificationChannelName } from '../notifications/core/notification-channel.interface';
import { NOTIFICATION_TEMPLATES } from '../notifications/notification.constants';
import type { NotificationPreferenceService } from '../notifications/preferences/notification-preference.service';
import type { PrismaService } from '../prisma/prisma.service';
import { GateNotificationListener } from './gate-notification.listener';
import type { GateEntryService } from './gate-entry.service';

const EVENT: GateEntryEvent = {
  name: DomainEventName.GateEntryCreated,
  occurredAt: new Date(),
  tenantId: 't-1',
  communityId: 'c-1',
  actorId: 'guard-1',
  entityId: 'ge-1',
  data: {
    entryNumber: 'GE-000001',
    entryType: 'DELIVERY',
    status: 'CREATED',
    unitId: 'unit-1',
    residentId: 'res-1',
    personName: 'Ramesh',
    vendorName: 'Swiggy',
  },
};

function makeListener(options: {
  channels?: NotificationChannelName[];
  enabled?: boolean;
  /** Channels whose dispatch should throw (e.g. no push device registered). */
  failing?: NotificationChannelName[];
  residentId?: string | null;
} = {}) {
  const failing = new Set(options.failing ?? []);

  const prisma = {
    gateEntry: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ge-1',
        entryNumber: 'GE-000001',
        personName: 'Ramesh',
        vendorName: 'Swiggy',
        deliveryType: 'FOOD',
        mobileNumber: '9876500000',
        createdAt: new Date('2026-08-05T10:00:00Z'),
        gate: { name: 'Main Gate' },
      }),
    },
    unit: { findUnique: jest.fn().mockResolvedValue({ unitNumber: 'A-101' }) },
  } as unknown as PrismaService;

  const dispatcher = {
    dispatch: jest.fn((message: { channel: NotificationChannelName }) =>
      failing.has(message.channel)
        ? Promise.reject(new Error('no device'))
        : Promise.resolve({ deliveryId: 'd', jobId: 'j' }),
    ),
    dispatchTemplate: jest.fn((channel: NotificationChannelName) =>
      failing.has(channel)
        ? Promise.reject(new Error('smtp down'))
        : Promise.resolve({ deliveryId: 'd', jobId: 'j' }),
    ),
  } as unknown as NotificationDispatcher;

  const preferences = {
    resolve: jest.fn().mockResolvedValue({
      enabled: options.enabled ?? true,
      channels: options.channels ?? (['inapp', 'push'] as NotificationChannelName[]),
    }),
  } as unknown as NotificationPreferenceService;

  const recipients = {
    resolve: jest.fn((channel: NotificationChannelName) =>
      Promise.resolve(
        channel === 'inapp' || channel === 'push' ? 'user-res-1' : `res-1@${channel}.test`,
      ),
    ),
  } as unknown as RecipientResolver;

  const entries = { markNotified: jest.fn().mockResolvedValue(undefined) } as unknown as GateEntryService;
  const config = { get: () => 'https://app.living.test' } as never;

  const listener = new GateNotificationListener(
    prisma,
    dispatcher,
    preferences,
    recipients,
    entries,
    config,
  );
  return { listener, dispatcher, preferences, entries, recipients };
}

describe('GateNotificationListener', () => {
  it('routes through the Notification Engine — never a provider directly', async () => {
    const { listener, dispatcher, preferences } = makeListener();

    await listener.onGateEntryCreated(EVENT);

    // The engine decides the channels; the gate module only asks.
    expect(preferences.resolve).toHaveBeenCalledWith('c-1', NotificationEvent.GATE_ENTRY_ARRIVED);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    const channels = (dispatcher.dispatch as jest.Mock).mock.calls.map((c) => c[0].channel);
    expect(channels).toEqual(['inapp', 'push']);
  });

  it('carries everything the popup needs so it renders without a follow-up fetch', async () => {
    const { listener, dispatcher } = makeListener({ channels: ['inapp'] });

    await listener.onGateEntryCreated(EVENT);

    const message = (dispatcher.dispatch as jest.Mock).mock.calls[0][0];
    expect(message.subject).toBe('Delivery at Main Gate');
    expect(message.to).toBe('user-res-1');
    expect(message.channelData).toMatchObject({
      entryId: 'ge-1',
      unitNumber: 'A-101',
      vendorName: 'Swiggy',
      personName: 'Ramesh',
      url: '/gate/ge-1',
      requireInteraction: true,
    });
    expect(message.channelData.actions).toEqual([
      { action: 'approve', title: 'Approve' },
      { action: 'reject', title: 'Reject' },
    ]);
  });

  it('renders email and WhatsApp from the shared template, not a bespoke body', async () => {
    const { listener, dispatcher } = makeListener({ channels: ['email', 'whatsapp'] });

    await listener.onGateEntryCreated(EVENT);

    expect(dispatcher.dispatchTemplate).toHaveBeenCalledTimes(2);
    for (const call of (dispatcher.dispatchTemplate as jest.Mock).mock.calls) {
      expect(call[1]).toBe(NOTIFICATION_TEMPLATES.GATE_ENTRY_ARRIVED);
    }
  });

  it('marks the entry NOTIFIED with the channels that actually worked', async () => {
    const { listener, entries } = makeListener({ channels: ['inapp', 'push'] });

    await listener.onGateEntryCreated(EVENT);

    expect(entries.markNotified).toHaveBeenCalledWith('ge-1', {
      channels: ['inapp', 'push'],
      failed: false,
    });
  });

  /** A resident with no push device must still get the in-app popup. */
  it('keeps going when one channel fails', async () => {
    const { listener, entries } = makeListener({ channels: ['inapp', 'push'], failing: ['push'] });

    await listener.onGateEntryCreated(EVENT);

    expect(entries.markNotified).toHaveBeenCalledWith('ge-1', {
      channels: ['inapp'],
      failed: false,
    });
  });

  /** Security has to know to phone the resident instead. */
  it('flags failure when every channel fails', async () => {
    const { listener, entries } = makeListener({
      channels: ['inapp', 'push'],
      failing: ['inapp', 'push'],
    });

    await listener.onGateEntryCreated(EVENT);

    expect(entries.markNotified).toHaveBeenCalledWith('ge-1', { channels: [], failed: true });
  });

  it('flags failure when the unit has no resident to notify', async () => {
    const { listener, entries, dispatcher } = makeListener();

    await listener.onGateEntryCreated({
      ...EVENT,
      data: { ...EVENT.data, residentId: null },
    });

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(entries.markNotified).toHaveBeenCalledWith('ge-1', { channels: [], failed: true });
  });

  it('sends nothing when the community has gate notifications switched off', async () => {
    const { listener, dispatcher, entries } = makeListener({ enabled: false, channels: [] });

    await listener.onGateEntryCreated(EVENT);

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(entries.markNotified).toHaveBeenCalledWith('ge-1', { channels: [], failed: true });
  });

  /** A notification problem must never break the guard's write. */
  it('swallows an unexpected error and records the failure', async () => {
    const { listener, entries, preferences } = makeListener();
    (preferences.resolve as jest.Mock).mockRejectedValue(new Error('database gone'));

    await expect(listener.onGateEntryCreated(EVENT)).resolves.toBeUndefined();
    expect(entries.markNotified).toHaveBeenCalledWith('ge-1', { channels: [], failed: true });
  });
});
