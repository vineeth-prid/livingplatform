import { NotificationEvent } from '@prisma/client';

import { DomainEventName, type DomainEvent } from '../../events/domain-events';
import type { PrismaService } from '../../prisma/prisma.service';
import { NOTIFICATION_TEMPLATES } from '../notification.constants';
import type { NotificationPreferenceService } from '../preferences/notification-preference.service';
import { NotificationRouterService } from './notification-router.service';
import type { NotificationDispatcher } from './notification.dispatcher';
import type { RecipientResolver, RecipientRef } from './recipient-resolver';
import type { EmailTemplateEngine } from './templates/template.engine';

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

function makeRouter(approvers: { id: string; email: string; firstName: string }[]) {
  const prisma = {
    visitor: { findUnique: jest.fn().mockResolvedValue(VISITOR) },
    community: { findUnique: jest.fn().mockResolvedValue({ name: 'Green Valley' }) },
    userRole: {
      findMany: jest.fn().mockResolvedValue(approvers.map((user) => ({ user }))),
    },
  } as unknown as PrismaService;

  const dispatcher = {
    dispatchTemplate: jest.fn().mockResolvedValue({ deliveryId: 'd', jobId: 'j' }),
    dispatch: jest.fn(),
  } as unknown as NotificationDispatcher;

  const preferences = {
    resolve: jest.fn().mockResolvedValue({ enabled: true, channels: ['email'] }),
    templateFor: jest.fn().mockResolvedValue(null),
  } as unknown as NotificationPreferenceService;

  // Every ref resolves to an address so routing, not addressing, is under test.
  const recipients = {
    resolve: jest.fn((_c: string, ref: RecipientRef) =>
      Promise.resolve(ref.email ?? `${ref.residentId}@example.test`),
    ),
  } as unknown as RecipientResolver;

  const templates = {} as EmailTemplateEngine;
  const config = { get: () => 'https://app.living.test' } as never;

  const router = new NotificationRouterService(
    prisma,
    dispatcher,
    preferences,
    recipients,
    templates,
    config,
  );
  return { router, dispatcher, prisma };
}

const event = (name: string): DomainEvent =>
  ({
    name,
    tenantId: 't-1',
    communityId: 'c-1',
    actorId: 'u-actor',
    entityId: 'v-1',
    occurredAt: new Date(),
    data: {},
  }) as DomainEvent;

describe('NotificationRouterService — visitor fan-out', () => {
  it('tells the resident AND every community approver about a new visitor', async () => {
    const { router, dispatcher } = makeRouter([
      { id: 'u-1', email: 'guard@living.test', firstName: 'Ravi' },
      { id: 'u-2', email: 'fm@living.test', firstName: 'Meera' },
    ]);

    await router.onDomainEvent(event(DomainEventName.VisitorCreated));

    const calls = (dispatcher.dispatchTemplate as jest.Mock).mock.calls;
    expect(calls).toHaveLength(3);

    // The resident gets their gate pass.
    expect(calls[0][1]).toBe(NOTIFICATION_TEMPLATES.VISITOR_PASS);

    // The approvers get an approval request naming the host and unit.
    const approverCalls = calls.slice(1);
    expect(approverCalls.map((c) => c[1])).toEqual([
      NOTIFICATION_TEMPLATES.VISITOR_PENDING,
      NOTIFICATION_TEMPLATES.VISITOR_PENDING,
    ]);
    expect(approverCalls.map((c) => c[2])).toEqual(['guard@living.test', 'fm@living.test']);
    expect(approverCalls[0][3]).toMatchObject({
      hostName: 'Aisha Khan',
      unitNumber: 'A-101',
      visitorName: 'Ramesh Kumar',
      actionUrl: 'https://app.living.test/visitors/v-1',
    });
  });

  it('sends one message per approver even when they hold several qualifying roles', async () => {
    const dupe = { id: 'u-1', email: 'guard@living.test', firstName: 'Ravi' };
    const { router, dispatcher } = makeRouter([dupe, dupe]);

    await router.onDomainEvent(event(DomainEventName.VisitorCreated));

    expect(dispatcher.dispatchTemplate).toHaveBeenCalledTimes(2); // resident + one guard
  });

  it('does not re-alert approvers once the visit is approved', async () => {
    const { router, dispatcher } = makeRouter([
      { id: 'u-1', email: 'guard@living.test', firstName: 'Ravi' },
    ]);

    await router.onDomainEvent(event(DomainEventName.VisitorApproved));

    expect(dispatcher.dispatchTemplate).toHaveBeenCalledTimes(1);
    expect((dispatcher.dispatchTemplate as jest.Mock).mock.calls[0][1]).toBe(
      NOTIFICATION_TEMPLATES.VISITOR_APPROVED,
    );
  });

  it('stays silent when the community has the event switched off', async () => {
    const { router, dispatcher } = makeRouter([
      { id: 'u-1', email: 'guard@living.test', firstName: 'Ravi' },
    ]);
    const preferences = (router as unknown as { preferences: NotificationPreferenceService })
      .preferences;
    (preferences.resolve as jest.Mock).mockResolvedValue({
      enabled: false,
      channels: [],
      event: NotificationEvent.VISITOR_PASS,
    });

    await router.onDomainEvent(event(DomainEventName.VisitorCreated));

    expect(dispatcher.dispatchTemplate).not.toHaveBeenCalled();
  });
});

/**
 * These seven events were bound in EVENT_MAP — so they appeared in the
 * community's notification-preferences UI with working toggles — while
 * `contextFor` returned null for every one of them. An admin could switch
 * WhatsApp on for "Ticket assigned", watch the toggle save, and nothing would
 * ever send, on any channel. The code claimed the engines notified directly;
 * they did not, and nothing else listened.
 *
 * The failure was silent by construction: no error, no log, no delivery row.
 * Each event therefore gets a test asserting a message is actually produced.
 */
describe('NotificationRouterService — work events reach their assignee', () => {
  const TICKET = {
    number: 42, title: 'Leaking tap', status: 'IN_PROGRESS',
    residentId: 'res-1', assignedStaffId: 'staff-1', assignedVendorId: null,
  };
  const REQUEST = {
    number: 7, title: 'Deep clean', residentId: 'res-1',
    assignedStaffId: null, assignedVendorId: 'vendor-1',
  };
  const WORK_ORDER = {
    number: 9, title: 'Replace pump', completedDate: new Date('2026-08-06T10:00:00Z'),
    assignedStaffId: 'staff-1', assignedVendorId: null,
  };

  function makeWorkRouter(channels: string[] = ['email', 'whatsapp']) {
    const { router, dispatcher, prisma } = makeRouter([]);
    const p = prisma as unknown as Record<string, { findUnique: jest.Mock }>;
    p.ticket = { findUnique: jest.fn().mockResolvedValue(TICKET) };
    p.serviceRequest = { findUnique: jest.fn().mockResolvedValue(REQUEST) };
    p.workOrder = { findUnique: jest.fn().mockResolvedValue(WORK_ORDER) };

    const preferences = (router as unknown as { preferences: NotificationPreferenceService })
      .preferences;
    (preferences.resolve as jest.Mock).mockResolvedValue({ enabled: true, channels });
    return { router, dispatcher };
  }

  it.each([
    [DomainEventName.TicketAssigned, NOTIFICATION_TEMPLATES.TICKET_ASSIGNED],
    [DomainEventName.TicketCreated, NOTIFICATION_TEMPLATES.TICKET_CREATED],
    [DomainEventName.TicketStatusChanged, NOTIFICATION_TEMPLATES.TICKET_UPDATED],
    [DomainEventName.ServiceAssigned, NOTIFICATION_TEMPLATES.SERVICE_ASSIGNED],
    [DomainEventName.WorkOrderAssigned, NOTIFICATION_TEMPLATES.WORK_ORDER_ASSIGNED],
    [DomainEventName.WorkCompleted, NOTIFICATION_TEMPLATES.WORK_ORDER_COMPLETED],
  ])('%s sends on every enabled channel', async (name, template) => {
    const { router, dispatcher } = makeWorkRouter();

    await router.onDomainEvent(event(name));

    const calls = (dispatcher.dispatchTemplate as jest.Mock).mock.calls;
    // One per enabled channel — this is the WhatsApp bug: email alone is a pass
    // for the old code path but not for a community that enabled WhatsApp.
    expect(calls.map((c) => c[0])).toEqual(['email', 'whatsapp']);
    expect(calls[0][1]).toBe(template);
  });

  it('addresses the assignee on assignment, not the resident', async () => {
    const { router, dispatcher } = makeWorkRouter(['whatsapp']);
    const recipients = (router as unknown as { recipients: RecipientResolver }).recipients;

    await router.onDomainEvent(event(DomainEventName.TicketAssigned));

    const ref = (recipients.resolve as jest.Mock).mock.calls[0][1] as RecipientRef;
    expect(ref.staffId).toBe('staff-1');
    expect(ref.residentId).toBeUndefined();
    expect(dispatcher.dispatchTemplate).toHaveBeenCalledTimes(1);
  });

  it('falls back to the vendor when no staff member is assigned', async () => {
    const { router } = makeWorkRouter(['whatsapp']);
    const recipients = (router as unknown as { recipients: RecipientResolver }).recipients;

    await router.onDomainEvent(event(DomainEventName.ServiceAssigned));

    const ref = (recipients.resolve as jest.Mock).mock.calls[0][1] as RecipientRef;
    expect(ref.vendorId).toBe('vendor-1');
  });

  it('stays silent when nothing is assigned yet — a normal state, not an error', async () => {
    const { router, dispatcher } = makeWorkRouter(['whatsapp']);
    const prisma = (router as unknown as { prisma: Record<string, { findUnique: jest.Mock }> })
      .prisma;
    prisma.ticket.findUnique.mockResolvedValue({
      ...TICKET, assignedStaffId: null, assignedVendorId: null,
    });

    await router.onDomainEvent(event(DomainEventName.TicketAssigned));

    expect(dispatcher.dispatchTemplate).not.toHaveBeenCalled();
  });
});
