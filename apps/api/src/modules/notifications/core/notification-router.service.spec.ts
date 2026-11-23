import { NotificationEvent } from '@prisma/client';

import { DomainEventName, type DomainEvent } from '../../events/domain-events';
import type { PrismaService } from '../../prisma/prisma.service';
import { NOTIFICATION_TEMPLATES } from '../notification.constants';
import type { NotificationPreferenceService } from '../preferences/notification-preference.service';
import { LIVING_BRAND, type NotificationBrand, type NotificationBrandingResolver } from './notification-branding';
import { NotificationRenderer } from './notification-renderer';
import { NotificationRouterService } from './notification-router.service';
import type { NotificationDispatcher } from './notification.dispatcher';
import type { RecipientResolver, RecipientRef } from './recipient-resolver';
import { EmailTemplateEngine } from './templates/template.engine';

const VISITOR = {
  id: 'v-1',
  residentId: 'res-1',
  visitorName: 'Ramesh Kumar',
  mobileNumber: '9876500000',
  passCode: 'AB12CD',
  expectedArrival: new Date('2026-08-05T09:00:00Z'),
  resident: {
    firstName: 'Aisha',
    lastName: 'Khan',
    unitAssignment: { unit: { unitNumber: 'A-101' } },
  },
};

const ABC: NotificationBrand = {
  ...LIVING_BRAND,
  community_name: 'ABC Residency',
  brand_name: 'ABC Residency',
  signature: 'ABC Residency Management Team',
  branded: true,
  sender_name: 'ABC Residency',
};

const engine = new EmailTemplateEngine();

function makeRouter(
  approvers: { id: string; email: string; firstName: string }[],
  brand: NotificationBrand = ABC,
) {
  const prisma = {
    visitor: { findUnique: jest.fn().mockResolvedValue(VISITOR) },
    userRole: {
      findMany: jest.fn().mockResolvedValue(approvers.map((user) => ({ user }))),
    },
  } as unknown as PrismaService;

  const dispatcher = {
    dispatch: jest.fn().mockResolvedValue({ deliveryId: 'd', jobId: 'j' }),
    recordRefused: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationDispatcher;

  const preferences = {
    resolve: jest.fn().mockResolvedValue({ enabled: true, channels: ['email'] }),
    templateFor: jest.fn().mockResolvedValue(null),
  } as unknown as NotificationPreferenceService;

  // Every ref resolves to an address so routing, not addressing, is under test.
  const recipients = {
    contact: jest.fn((_c: string, ref: RecipientRef) =>
      Promise.resolve({ address: ref.email ?? `${ref.residentId ?? ref.staffId ?? ref.vendorId}@example.test`, name: ref.name ?? 'Vineeth' }),
    ),
  } as unknown as RecipientResolver;

  const branding = { for: jest.fn().mockResolvedValue(brand) } as unknown as NotificationBrandingResolver;
  // The REAL renderer and engine: these tests assert on what residents read.
  const renderer = new NotificationRenderer(engine, branding);
  const config = {
    get: (k: string) => (k === 'payments' ? { currency: 'INR' } : 'https://platform.living.test'),
  } as never;

  // Ownership answers "who owes for this unit?". Stubbed to the invoice's own
  // resident so the routing tests keep testing routing.
  const ownership = {
    notifiableResidentsFor: jest.fn(() => Promise.resolve(['res-1'])),
  } as never;

  const router = new NotificationRouterService(
    prisma,
    dispatcher,
    preferences,
    recipients,
    renderer,
    branding,
    ownership,
    config,
  );
  return { router, dispatcher, prisma, preferences };
}

const event = (name: string, data: Record<string, unknown> = {}): DomainEvent =>
  ({
    name,
    tenantId: 't-1',
    communityId: 'c-1',
    actorId: 'u-actor',
    entityId: 'v-1',
    occurredAt: new Date('2026-11-23T09:10:00Z'),
    data,
  }) as DomainEvent;

type Sent = { channel: string; to: string; subject: string; text: string; html?: string; fromName?: string };
const sent = (dispatcher: NotificationDispatcher) =>
  (dispatcher.dispatch as jest.Mock).mock.calls.map((c) => ({ ...(c[0] as Sent), ctx: c[1] }));

describe('NotificationRouterService — visitor fan-out', () => {
  it('tells the resident AND every community approver about a new visitor', async () => {
    const { router, dispatcher } = makeRouter([
      { id: 'u-1', email: 'guard@living.test', firstName: 'Ravi' },
      { id: 'u-2', email: 'fm@living.test', firstName: 'Meera' },
    ]);

    await router.onDomainEvent(event(DomainEventName.VisitorCreated));

    const calls = sent(dispatcher);
    expect(calls).toHaveLength(3);
    expect(calls[0].ctx.template).toBe(NOTIFICATION_TEMPLATES.VISITOR_PASS);

    // The approvers get an approval request naming the host and unit.
    const approvers = calls.slice(1);
    expect(approvers.map((c) => c.ctx.template)).toEqual([
      NOTIFICATION_TEMPLATES.VISITOR_PENDING,
      NOTIFICATION_TEMPLATES.VISITOR_PENDING,
    ]);
    expect(approvers.map((c) => c.to)).toEqual(['guard@living.test', 'fm@living.test']);
    expect(approvers[0].text).toContain('Hello Ravi,');
    expect(approvers[0].text).toContain('Aisha Khan');
    expect(approvers[0].text).toContain('A-101');
    expect(approvers[0].html).toContain('https://platform.living.test/visitors/v-1');
  });

  it('sends one message per approver even when they hold several qualifying roles', async () => {
    const dupe = { id: 'u-1', email: 'guard@living.test', firstName: 'Ravi' };
    const { router, dispatcher } = makeRouter([dupe, dupe]);

    await router.onDomainEvent(event(DomainEventName.VisitorCreated));

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2); // resident + one guard
  });

  it('does not re-alert approvers once the visit is approved', async () => {
    const { router, dispatcher } = makeRouter([
      { id: 'u-1', email: 'guard@living.test', firstName: 'Ravi' },
    ]);

    await router.onDomainEvent(event(DomainEventName.VisitorApproved));

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(sent(dispatcher)[0].ctx.template).toBe(NOTIFICATION_TEMPLATES.VISITOR_APPROVED);
  });

  it('stays silent when the community has the event switched off', async () => {
    const { router, dispatcher, preferences } = makeRouter([
      { id: 'u-1', email: 'guard@living.test', firstName: 'Ravi' },
    ]);
    (preferences.resolve as jest.Mock).mockResolvedValue({
      enabled: false,
      channels: [],
      event: NotificationEvent.VISITOR_PASS,
    });

    await router.onDomainEvent(event(DomainEventName.VisitorCreated));

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});

/**
 * These events were once bound in EVENT_MAP while `contextFor` returned null
 * for every one of them — toggles that saved and sent nothing. Each event gets
 * a test asserting a message is actually produced on every enabled channel.
 */
describe('NotificationRouterService — work events reach their assignee', () => {
  const TICKET = {
    number: 42, title: 'Leaking tap', description: 'Kitchen tap drips all night', status: 'IN_PROGRESS',
    residentId: 'res-1', assignedStaffId: 'staff-1', assignedVendorId: null,
    createdAt: new Date('2026-11-23T04:35:00Z'), assignedAt: new Date('2026-11-23T05:00:00Z'),
    unit: { unitNumber: 'B-204' },
  };
  const REQUEST = {
    number: 7, title: 'Deep clean', residentId: 'res-1', preferredDate: null, preferredTimeSlot: null,
    assignedStaffId: null, assignedVendorId: 'vendor-1', unit: { unitNumber: 'B-204' },
  };
  const WORK_ORDER = {
    number: 9, title: 'Replace pump', completedDate: new Date('2026-08-06T10:00:00Z'),
    assignedAt: null, dueDate: null, assignedStaffId: 'staff-1', assignedVendorId: null,
  };

  function makeWorkRouter(channels: string[] = ['email', 'whatsapp'], brand?: NotificationBrand) {
    const made = makeRouter([], brand);
    const p = made.prisma as unknown as Record<string, { findUnique: jest.Mock }>;
    p.ticket = { findUnique: jest.fn().mockResolvedValue(TICKET) };
    p.serviceRequest = { findUnique: jest.fn().mockResolvedValue(REQUEST) };
    p.workOrder = { findUnique: jest.fn().mockResolvedValue(WORK_ORDER) };
    (made.preferences.resolve as jest.Mock).mockResolvedValue({ enabled: true, channels });
    return made;
  }

  it.each([
    [DomainEventName.TicketAssigned, NOTIFICATION_TEMPLATES.TICKET_ASSIGNED],
    [DomainEventName.TicketCreated, NOTIFICATION_TEMPLATES.TICKET_CREATED],
    [DomainEventName.TicketStatusChanged, NOTIFICATION_TEMPLATES.TICKET_UPDATED],
    [DomainEventName.ServiceAssigned, NOTIFICATION_TEMPLATES.SERVICE_ASSIGNED],
    [DomainEventName.ServiceCompleted, NOTIFICATION_TEMPLATES.SERVICE_UPDATED],
    [DomainEventName.WorkOrderAssigned, NOTIFICATION_TEMPLATES.WORK_ORDER_ASSIGNED],
    [DomainEventName.WorkCompleted, NOTIFICATION_TEMPLATES.WORK_ORDER_UPDATED],
  ])('%s sends on every enabled channel', async (name, template) => {
    const { router, dispatcher } = makeWorkRouter();

    await router.onDomainEvent(event(name, { status: 'IN_PROGRESS', fromStatus: 'OPEN' }));

    const calls = sent(dispatcher);
    expect(calls.map((c) => c.channel)).toEqual(['email', 'whatsapp']);
    expect(calls[0].ctx.template).toBe(template);
    expect(dispatcher.recordRefused).not.toHaveBeenCalled();
  });

  it('addresses the assignee on assignment, not the resident, with a workforce link', async () => {
    const { router, dispatcher } = makeWorkRouter(['whatsapp']);
    const recipients = (router as unknown as { recipients: RecipientResolver }).recipients;

    await router.onDomainEvent(event(DomainEventName.TicketAssigned));

    const ref = (recipients.contact as jest.Mock).mock.calls[0][1] as RecipientRef;
    expect(ref.staffId).toBe('staff-1');
    expect(ref.residentId).toBeUndefined();
    expect(sent(dispatcher)[0].text).toContain('https://workforce.platform.living.test/jobs/ticket/v-1');
  });

  it('falls back to the vendor when no staff member is assigned', async () => {
    const { router } = makeWorkRouter(['whatsapp']);
    const recipients = (router as unknown as { recipients: RecipientResolver }).recipients;

    await router.onDomainEvent(event(DomainEventName.ServiceAssigned));

    const ref = (recipients.contact as jest.Mock).mock.calls[0][1] as RecipientRef;
    expect(ref.vendorId).toBe('vendor-1');
  });

  it('stays silent when nothing is assigned yet — a normal state, not an error', async () => {
    const { router, dispatcher, prisma } = makeWorkRouter(['whatsapp']);
    (prisma as unknown as Record<string, { findUnique: jest.Mock }>).ticket.findUnique.mockResolvedValue({
      ...TICKET, assignedStaffId: null, assignedVendorId: null,
    });

    await router.onDomainEvent(event(DomainEventName.TicketAssigned));

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  /**
   * The message that started this: "Hello ,  Ticket TKT-000116 — 'Not clean' —
   * is now .  Status: in progress  View ticket".
   */
  describe('ticket update wording', () => {
    const whatsapp = async (data: Record<string, unknown>, brand?: NotificationBrand, row?: Partial<typeof TICKET>) => {
      const { router, dispatcher, prisma } = makeWorkRouter(['whatsapp'], brand);
      if (row) {
        (prisma as unknown as Record<string, { findUnique: jest.Mock }>).ticket.findUnique.mockResolvedValue({ ...TICKET, ...row });
      }
      await router.onDomainEvent(event(DomainEventName.TicketStatusChanged, data));
      return { msg: sent(dispatcher)[0], dispatcher };
    };

    it('greets the resident by name and states the real status once', async () => {
      const { msg } = await whatsapp({ status: 'IN_PROGRESS', fromStatus: 'OPEN' });
      expect(msg.text).toContain('*Ticket Update – TKT-000042*');
      expect(msg.text).toContain('Hello Vineeth,');
      expect(msg.text).toContain('Current Status: In Progress');
      expect(msg.text.match(/In Progress/g)).toHaveLength(1);
      expect(msg.text).toContain('Our maintenance team is currently working on your request.');
      expect(msg.text).toContain('View Ticket: https://resident.platform.living.test/requests/ticket/v-1?c=c-1');
      expect(msg.text).not.toMatch(/Hello ,|is now \.|undefined|null|&#x27;|<[a-z]/);
    });

    it('In Progress → Resolved asks the resident to review', async () => {
      const { msg } = await whatsapp({ status: 'RESOLVED', fromStatus: 'IN_PROGRESS' });
      expect(msg.text).toContain('Current Status: Resolved');
      expect(msg.text).toContain('marked as resolved');
    });

    it('assignment says the team has it', async () => {
      const { msg } = await whatsapp({ status: 'ASSIGNED', fromStatus: 'OPEN' });
      expect(msg.text).toContain('assigned to our maintenance team');
    });

    it('a request for more information comes through as the team\'s own note', async () => {
      const { msg } = await whatsapp({
        status: 'ON_HOLD', fromStatus: 'IN_PROGRESS', note: 'Please share a photo of the leak.',
      });
      expect(msg.text).toContain('Current Status: On Hold');
      expect(msg.text).toContain('Note from our team: Please share a photo of the leak.');
    });

    it('a reopened ticket is described as reopened, not as new work', async () => {
      const { msg } = await whatsapp({ status: 'IN_PROGRESS', fromStatus: 'RESOLVED' });
      expect(msg.text).toContain('has been reopened');
    });

    it('no recipient name → "Hello," rather than "Hello ,"', async () => {
      const { router, dispatcher } = makeWorkRouter(['whatsapp']);
      const recipients = (router as unknown as { recipients: RecipientResolver }).recipients;
      (recipients.contact as jest.Mock).mockResolvedValue({ address: '+919820000001', name: '' });
      await router.onDomainEvent(event(DomainEventName.TicketStatusChanged, { status: 'IN_PROGRESS' }));
      const text = sent(dispatcher)[0].text;
      expect(text).toContain('Hello,');
      expect(text).not.toContain('Hello ,');
    });

    it('an unknown status leaves out the description instead of inventing one', async () => {
      const { msg } = await whatsapp({ status: 'SOMETHING_NEW' });
      expect(msg.text).toContain('Current Status: Something New');
      expect(msg.text).not.toMatch(/\n\n\n/);
    });

    it('long titles and special characters arrive intact — no HTML entities in WhatsApp', async () => {
      const title = `Water "leak" & damp — Tom's flat <B-204> ${'very '.repeat(30)}long`;
      const { msg } = await whatsapp({ status: 'IN_PROGRESS' }, undefined, { title });
      expect(msg.text).toContain(`Issue: ${title}`);
    });

    it('escapes the same characters in email HTML', async () => {
      const { router, dispatcher, prisma } = makeWorkRouter(['email']);
      (prisma as unknown as Record<string, { findUnique: jest.Mock }>).ticket.findUnique.mockResolvedValue({ ...TICKET, title: '<script>x</script>' });
      await router.onDomainEvent(event(DomainEventName.TicketStatusChanged, { status: 'IN_PROGRESS' }));
      const html = sent(dispatcher)[0].html!;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('a missing ticket number is recorded as refused and NOT sent', async () => {
      const { router, dispatcher, prisma } = makeWorkRouter(['whatsapp']);
      (prisma as unknown as Record<string, { findUnique: jest.Mock }>).ticket.findUnique.mockResolvedValue({ ...TICKET, title: '' });
      await router.onDomainEvent(event(DomainEventName.TicketStatusChanged, { status: 'IN_PROGRESS' }));
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect((dispatcher.recordRefused as jest.Mock).mock.calls[0][2]).toBe('Not sent: missing ticket_title');
    });

    it('a branded community signs as itself — never as Living', async () => {
      const { msg } = await whatsapp({ status: 'IN_PROGRESS' }, ABC);
      expect(msg.text).toMatch(/Regards,\n\*ABC Residency Management Team\*$/);
      expect(msg.text).not.toContain('Living');
    });

    it('an unbranded community keeps the Living identity', async () => {
      const { msg } = await whatsapp({ status: 'IN_PROGRESS' }, { ...LIVING_BRAND, community_name: 'Plain Towers' });
      expect(msg.text).toContain('*Living Community Management Team*');
    });

    it('branded email carries the community name as the display name and in the header', async () => {
      const { router, dispatcher } = makeWorkRouter(['email'], ABC);
      await router.onDomainEvent(event(DomainEventName.TicketStatusChanged, { status: 'IN_PROGRESS' }));
      const mail = sent(dispatcher)[0];
      expect(mail.fromName).toBe('ABC Residency');
      expect(mail.subject).toBe('Ticket update — TKT-000042: In Progress');
      expect(mail.html).toContain('ABC Residency Management Team');
      expect(mail.html).not.toMatch(/Living/);
    });

    it('carries a dedupe key per event, template, channel and recipient', async () => {
      const { msg } = await whatsapp({ status: 'IN_PROGRESS' });
      expect(msg.ctx.dedupeKey).toBe(
        `ticket.status_changed:v-1:2026-11-23T09:10:00.000Z:${NOTIFICATION_TEMPLATES.TICKET_UPDATED}:whatsapp:res-1@example.test`,
      );
    });
  });
});

describe('NotificationRouterService — announcements', () => {
  function makeAnnounceRouter(enabled = true) {
    const made = makeRouter([]);
    const p = made.prisma as unknown as Record<string, unknown>;
    p.announcement = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'a-1', title: 'Water shutdown on Sunday', content: `Water will be off from 10 to 2. ${'Details '.repeat(40)}`,
      }),
    };
    p.resident = {
      findMany: jest.fn().mockResolvedValue([{ userId: 'u-1' }, { userId: 'u-2' }, { userId: 'u-1' }]),
    };
    (made.preferences as unknown as Record<string, jest.Mock>).isEnabled = jest.fn().mockResolvedValue(enabled);
    return made;
  }

  it('goes to every resident login as an in-app banner and a push — never email or WhatsApp', async () => {
    const { router, dispatcher, preferences } = makeAnnounceRouter();
    // Even with email + WhatsApp switched on for the event, they are not used.
    (preferences.resolve as jest.Mock).mockResolvedValue({ enabled: true, channels: ['email', 'whatsapp'] });

    await router.onDomainEvent(event(DomainEventName.AnnouncementPublished));

    const calls = sent(dispatcher);
    expect(calls.map((c) => c.channel)).toEqual(['inapp', 'push']);
    const banner = (dispatcher.dispatch as jest.Mock).mock.calls[0][0];
    expect(banner.to).toEqual(['u-1', 'u-2']);
    expect(banner.subject).toBe('Water shutdown on Sunday');
    expect(banner.text.length).toBeLessThanOrEqual(140);
    expect(banner.text.startsWith('Water will be off from 10 to 2. Details')).toBe(true);
    expect(banner.text.endsWith('…')).toBe(true);
    expect(banner.channelData).toMatchObject({ realtimeType: 'announcement.published', url: '/announcements' });
    expect(calls[0].ctx.dedupeKey).toContain('announcement.published:a-1:');
  });

  it('respects the event being switched off', async () => {
    const { router, dispatcher } = makeAnnounceRouter(false);
    await router.onDomainEvent(event(DomainEventName.AnnouncementPublished));
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });
});

describe('NotificationRouterService — payments', () => {
  const PAYMENT = {
    id: 'p-1', residentId: 'res-payer', unitId: 'unit-1', amount: 2500, currency: 'INR', purpose: 'MAINTENANCE',
    paidAt: new Date('2026-11-23T10:45:00Z'), method: 'cash', gatewayPaymentId: null, receiptNumber: 'RCPT-000231',
    invoice: { invoiceNumber: 'INV-2026-0142' },
  };
  function makePaymentRouter() {
    const made = makeRouter([]);
    (made.prisma as unknown as Record<string, unknown>).payment = { findUnique: jest.fn().mockResolvedValue(PAYMENT) };
    (made.preferences.resolve as jest.Mock).mockResolvedValue({ enabled: true, channels: ['whatsapp'] });
    return made;
  }

  it('a payment recorded by the admin confirms receipt to the unit owners on WhatsApp', async () => {
    const { router, dispatcher, preferences } = makePaymentRouter();
    await router.onDomainEvent(event(DomainEventName.PaymentRecorded));

    expect((preferences.resolve as jest.Mock).mock.calls[0][1]).toBe(NotificationEvent.PAYMENT_CONFIRMATION);
    const msg = sent(dispatcher)[0];
    expect(msg.to).toBe('res-1@example.test'); // the owner from OwnershipService, not the payer row
    expect(msg.text).toContain('*Payment Received Successfully*');
    expect(msg.text).toContain('Amount: INR 2,500.00');
    expect(msg.text).toContain('Purpose: Maintenance — INV-2026-0142');
    expect(msg.text).toContain('Method: Cash');
    expect(msg.text).toContain('Transaction Reference: RCPT-000231');
  });

  it('an online payment thanks the resident who paid, under Payment received', async () => {
    const { router, dispatcher, preferences } = makePaymentRouter();
    await router.onDomainEvent(event(DomainEventName.PaymentSucceeded));
    expect((preferences.resolve as jest.Mock).mock.calls[0][1]).toBe(NotificationEvent.PAYMENT_SUCCESS);
    expect(sent(dispatcher)[0].to).toBe('res-payer@example.test');
  });
});
