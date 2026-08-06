import { NotificationEvent } from '@prisma/client';

import { DomainEventName, type DomainEvent } from '../events/domain-events';
import type { PrismaService } from '../prisma/prisma.service';
import { ChannelRouter } from './core/channel-router';
import { NotificationDispatcher } from './core/notification.dispatcher';
import { NotificationRouterService } from './core/notification-router.service';
import { RecipientResolver } from './core/recipient-resolver';
import { EmailTemplateEngine } from './core/templates/template.engine';
import type { DeliveryTracker } from './core/delivery-tracker';
import type { SenderResolver } from './core/sender-resolver';
import type { NotificationPreferenceService } from './preferences/notification-preference.service';
import type { INotificationChannel } from './core/notification-channel.interface';

/**
 * End-to-end validation of the notification pipeline, wired with REAL
 * components at every stage except the two edges (Prisma and the provider
 * socket).
 *
 * Every unit in this chain had passing tests while the chain itself delivered
 * nothing, because each stage was only ever tested against a mock of its
 * neighbour. The failures were all at the SEAMS:
 *
 *   • the router built no message for ticket events        (fdb7f38)
 *   • a resident's own ticket was stored with no residentId, so there was
 *     nobody to address                                    (this commit)
 *   • the template rendered but the address was never resolved
 *   • a hung provider held the only worker slots            (8e3622b)
 *
 * So this walks the whole path — domain event → preferences → context →
 * recipient resolution → template render → queue payload — and asserts a real
 * WhatsApp body comes out the far end addressed to a real E.164 number.
 */
describe('Notification pipeline · end to end', () => {
  const RESIDENT = {
    id: 'res-1',
    email: 'aisha@example.test',
    mobile: '9876543210',
    firstName: 'Aisha',
    userId: 'user-1',
  };
  const TICKET = {
    number: 42,
    title: 'Leaking tap',
    status: 'OPEN',
    residentId: RESIDENT.id,
    assignedStaffId: null,
    assignedVendorId: null,
  };

  function buildPipeline(channels: string[]) {
    const sent: Array<{ channel: string; to: string; text: string; subject: string }> = [];

    const prisma = {
      ticket: { findUnique: jest.fn().mockResolvedValue(TICKET) },
      resident: { findFirst: jest.fn().mockResolvedValue(RESIDENT) },
      community: { findUnique: jest.fn().mockResolvedValue({ name: 'Green Valley' }) },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    // The only stub below the dispatcher: the provider socket itself.
    const makeChannel = (name: string): INotificationChannel => ({
      channel: name as INotificationChannel['channel'],
      provider: name === 'email' ? 'smtp' : 'openwa',
      send: jest.fn((m) => {
        sent.push({
          channel: name,
          to: String(m.to),
          text: m.text ?? '',
          subject: m.subject ?? '',
        });
        return Promise.resolve({ messageId: 'p-1', provider: name, channel: name, raw: {} });
      }),
      verify: jest.fn().mockResolvedValue(true),
      health: jest.fn().mockResolvedValue({ state: 'healthy', channel: name, provider: name }),
      close: jest.fn().mockResolvedValue(undefined),
      supports: jest.fn().mockReturnValue(true),
    } as unknown as INotificationChannel);

    const router = new ChannelRouter([makeChannel('email'), makeChannel('whatsapp')]);
    const tracking = {
      createQueued: jest.fn().mockResolvedValue('del-1'),
      attachJob: jest.fn().mockResolvedValue(null),
      markProcessing: jest.fn().mockResolvedValue(null),
      markSent: jest.fn().mockResolvedValue(null),
    } as unknown as DeliveryTracker;

    // The queue is the one seam a unit test cannot cross; deliver immediately so
    // the assertion covers what the worker would actually transmit.
    const dispatcher = new NotificationDispatcher(
      router,
      { add: jest.fn().mockResolvedValue({ id: 'job-1' }) } as never,
      tracking,
      new EmailTemplateEngine(),
      { emailFor: jest.fn().mockResolvedValue({}) } as unknown as SenderResolver,
      { get: () => ({ queue: { attempts: 3 }, defaultLocale: 'en' }) } as never,
    );
    const queued: Array<{ channel: string; message: Record<string, unknown> }> = [];
    jest.spyOn(dispatcher, 'dispatch').mockImplementation(async (message) => {
      queued.push({ channel: message.channel, message: message as never });
      await dispatcher.deliver({ deliveryId: 'del-1', channel: message.channel, message });
      return { deliveryId: 'del-1', jobId: 'job-1' };
    });

    const preferences = {
      resolve: jest.fn().mockResolvedValue({ enabled: true, channels }),
      templateFor: jest.fn().mockResolvedValue(null),
    } as unknown as NotificationPreferenceService;

    const service = new NotificationRouterService(
      prisma,
      dispatcher,
      preferences,
      new RecipientResolver(prisma),
      new EmailTemplateEngine(),
      { get: () => 'https://app.living.test' } as never,
    );
    return { service, sent, prisma };
  }

  const event = (name: string): DomainEvent =>
    ({
      name,
      tenantId: 't-1',
      communityId: 'c-1',
      actorId: 'user-1',
      entityId: 'tkt-1',
      occurredAt: new Date(),
      data: {},
    }) as DomainEvent;

  it('delivers a real WhatsApp body to the resident who raised the ticket', async () => {
    const { service, sent } = buildPipeline(['whatsapp']);

    await service.onDomainEvent(event(DomainEventName.TicketCreated));

    expect(sent).toHaveLength(1);
    const message = sent[0]!;
    expect(message.channel).toBe('whatsapp');
    // The mobile is normalised to E.164 — an un-normalised number is silently
    // dropped by the resolver and nothing sends.
    expect(message.to).toBe('+919876543210');
    // A real rendered body, not an empty string: WhatsApp rejects an empty
    // text message, which would dead-letter every notification on the channel.
    expect(message.text).toContain('TKT-000042');
    expect(message.text).toContain('Leaking tap');
    expect(message.text.length).toBeGreaterThan(20);
  });

  it('delivers on email and WhatsApp together without either starving the other', async () => {
    const { service, sent } = buildPipeline(['email', 'whatsapp']);

    await service.onDomainEvent(event(DomainEventName.TicketCreated));

    expect(sent.map((s) => s.channel).sort()).toEqual(['email', 'whatsapp']);
    expect(sent.every((s) => s.text.length > 20)).toBe(true);
    expect(sent.find((s) => s.channel === 'email')!.subject).toContain('TKT-000042');
  });

  it('sends nothing when the resident has no usable mobile, and does not throw', async () => {
    const { service, sent, prisma } = buildPipeline(['whatsapp']);
    (prisma.resident.findFirst as jest.Mock).mockResolvedValue({ ...RESIDENT, mobile: null });

    await service.onDomainEvent(event(DomainEventName.TicketCreated));

    expect(sent).toHaveLength(0);
  });

  it('does not send when the community has the event switched off', async () => {
    const { service, sent } = buildPipeline(['whatsapp']);
    const preferences = (service as unknown as { preferences: NotificationPreferenceService })
      .preferences;
    (preferences.resolve as jest.Mock).mockResolvedValue({
      enabled: false,
      channels: [],
      event: NotificationEvent.TICKET_CREATED,
    });

    await service.onDomainEvent(event(DomainEventName.TicketCreated));

    expect(sent).toHaveLength(0);
  });
});
