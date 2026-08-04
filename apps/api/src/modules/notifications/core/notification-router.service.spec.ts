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
