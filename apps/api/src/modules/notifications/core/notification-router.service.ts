import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationEvent } from '@prisma/client';

import type { AppConfig } from '../../../config/configuration';
import { DomainEventName, type DomainEvent } from '../../events/domain-events';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../../rbac/rbac.constants';
import { formatServiceRequestNumber } from '../../service-request/service-request.service';
import { formatTicketNumber } from '../../ticket/ticket.service';
import { formatWorkOrderNumber } from '../../work-order/work-order.service';
import { NotificationPreferenceService } from '../preferences/notification-preference.service';
import { NOTIFICATION_TEMPLATES } from '../notification.constants';
import type { NotificationChannelName } from './notification-channel.interface';
import { OwnershipService } from '../../ownership/ownership.service';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationBrandingResolver } from './notification-branding';
import { appLinks, statusLabel, ticketUpdateDescription } from './notification-catalog';
import { MissingVariablesError, NotificationRenderer } from './notification-renderer';
import { RecipientResolver, type RecipientRef } from './recipient-resolver';
import { UnsafeTemplateError } from './templates/template.engine';

/**
 * The seam that turns a DOMAIN event into NOTIFICATIONS.
 *
 * Business modules keep publishing plain domain events and know nothing about
 * channels; this router decides — per community preference — which channels an
 * event goes out on, resolves the recipient, loads the message's values from
 * the authoritative records, and hands it to the ONE renderer and the ONE
 * dispatcher. Variable names and required values live in notification-catalog.
 *
 * Every failure is swallowed and logged: a notification must never break the
 * business transaction that triggered it.
 */

interface EventBinding {
  /** The configurable event a community routes/enables. */
  event: NotificationEvent;
  /** Platform default template (also the name a community override replaces). */
  template: string;
}

/** One addressed message. An event may produce several (different audiences). */
interface RoutedMessage {
  recipient: RecipientRef;
  variables: Record<string, unknown>;
  /** Overrides the binding's default template for this audience only. */
  template?: string;
}

const EVENT_MAP: Partial<Record<string, EventBinding>> = {
  [DomainEventName.PaymentSucceeded]: {
    event: NotificationEvent.PAYMENT_SUCCESS,
    template: NOTIFICATION_TEMPLATES.PAYMENT_SUCCESS,
  },
  // Recorded by an admin (cash, cheque, NEFT) — the online path is PaymentSucceeded.
  [DomainEventName.PaymentRecorded]: {
    event: NotificationEvent.PAYMENT_CONFIRMATION,
    template: NOTIFICATION_TEMPLATES.PAYMENT_SUCCESS,
  },
  // In-app banner + push only — never email/WhatsApp to the whole community.
  [DomainEventName.AnnouncementPublished]: {
    event: NotificationEvent.ANNOUNCEMENT,
    template: NOTIFICATION_TEMPLATES.ANNOUNCEMENT,
  },
  [DomainEventName.VisitorCreated]: {
    event: NotificationEvent.VISITOR_PASS,
    template: NOTIFICATION_TEMPLATES.VISITOR_PASS,
  },
  [DomainEventName.VisitorApproved]: {
    event: NotificationEvent.VISITOR_APPROVED,
    template: NOTIFICATION_TEMPLATES.VISITOR_APPROVED,
  },
  [DomainEventName.BookingCreated]: {
    event: NotificationEvent.BOOKING_CONFIRMED,
    template: NOTIFICATION_TEMPLATES.BOOKING_CONFIRMED,
  },
  [DomainEventName.TicketCreated]: {
    event: NotificationEvent.TICKET_CREATED,
    template: NOTIFICATION_TEMPLATES.TICKET_CREATED,
  },
  [DomainEventName.TicketAssigned]: {
    event: NotificationEvent.TICKET_ASSIGNED,
    template: NOTIFICATION_TEMPLATES.TICKET_ASSIGNED,
  },
  [DomainEventName.TicketStatusChanged]: {
    event: NotificationEvent.TICKET_UPDATE,
    template: NOTIFICATION_TEMPLATES.TICKET_UPDATED,
  },
  [DomainEventName.ServiceAssigned]: {
    event: NotificationEvent.SERVICE_ASSIGNED,
    template: NOTIFICATION_TEMPLATES.SERVICE_ASSIGNED,
  },
  [DomainEventName.ServiceCompleted]: {
    event: NotificationEvent.SERVICE_UPDATE,
    template: NOTIFICATION_TEMPLATES.SERVICE_UPDATED,
  },
  [DomainEventName.WorkOrderAssigned]: {
    event: NotificationEvent.WORK_ORDER_ASSIGNED,
    template: NOTIFICATION_TEMPLATES.WORK_ORDER_ASSIGNED,
  },
  // The approval lane. A recommendation is a request for a decision, and both
  // outcomes change what the resident should expect — so all three notify.
  [DomainEventName.WorkOrderRecommended]: {
    event: NotificationEvent.WORK_ORDER_UPDATE,
    template: NOTIFICATION_TEMPLATES.WORK_ORDER_UPDATED,
  },
  [DomainEventName.WorkOrderApproved]: {
    event: NotificationEvent.WORK_ORDER_UPDATE,
    template: NOTIFICATION_TEMPLATES.WORK_ORDER_UPDATED,
  },
  [DomainEventName.WorkOrderRejected]: {
    event: NotificationEvent.WORK_ORDER_UPDATE,
    template: NOTIFICATION_TEMPLATES.WORK_ORDER_UPDATED,
  },
  [DomainEventName.WorkCompleted]: {
    event: NotificationEvent.WORK_ORDER_UPDATE,
    template: NOTIFICATION_TEMPLATES.WORK_ORDER_UPDATED,
  },
  [DomainEventName.ResidentCreated]: {
    event: NotificationEvent.WELCOME,
    template: NOTIFICATION_TEMPLATES.WELCOME,
  },
};

/** Dates in the community's own timezone, the way residents read them. */
function formatDate(d: Date | null | undefined, tz: string, part: 'date' | 'time' | 'both' = 'both'): string {
  if (!d) return '';
  const opts: Intl.DateTimeFormatOptions = { timeZone: tz };
  if (part !== 'time') Object.assign(opts, { day: 'numeric', month: 'short', year: 'numeric' });
  if (part !== 'date') Object.assign(opts, { hour: 'numeric', minute: '2-digit' });
  return new Intl.DateTimeFormat('en-IN', opts).format(d);
}

@Injectable()
export class NotificationRouterService {
  private readonly logger = new Logger(NotificationRouterService.name);
  private readonly links: ReturnType<typeof appLinks>;
  private readonly currency: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly preferences: NotificationPreferenceService,
    private readonly recipients: RecipientResolver,
    private readonly renderer: NotificationRenderer,
    private readonly branding: NotificationBrandingResolver,
    private readonly ownership: OwnershipService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.links = appLinks(config.get('webAppUrl', { infer: true }));
    this.currency = config.get('payments', { infer: true }).currency;
  }

  @OnEvent('**', { async: true })
  async onDomainEvent(event: DomainEvent): Promise<void> {
    const binding = EVENT_MAP[event.name];
    if (!binding) return;
    try {
      await this.route(event, binding);
    } catch (err) {
      this.logger.error(
        `Notification routing failed for ${event.name} (${event.entityId})`,
        err as Error,
      );
    }
  }

  private async route(event: DomainEvent, binding: EventBinding): Promise<void> {
    if (binding.event === NotificationEvent.ANNOUNCEMENT) return this.announce(event);
    const routing = await this.preferences.resolve(event.communityId, binding.event);
    if (!routing.enabled) return;

    const messages = await this.contextFor(event);
    if (!messages?.length) return;

    const occurred = new Date(event.occurredAt ?? Date.now()).toISOString();
    for (const message of messages) {
      for (const channel of routing.channels) {
        const contact = await this.recipients.contact(channel, message.recipient);
        if (!contact.address) continue;
        await this.send(channel, binding, contact.address, {
          ...message.variables,
          recipient_name: message.variables.recipient_name || contact.name,
        }, {
          communityId: event.communityId,
          tenantId: event.tenantId,
          template: message.template,
          metadata: { domainEvent: event.name, entityId: event.entityId },
          dedupeKey: `${event.name}:${event.entityId}:${occurred}`,
        });
      }
    }
  }

  /**
   * Render through the shared renderer and dispatch on one channel. A
   * community's own wording replaces the event's DEFAULT message only — it was
   * never written for a secondary audience (an approver, the gate desk).
   *
   * A message missing a required value is recorded as FAILED with the missing
   * names and NOT sent: a broken message is worse than none.
   */
  private async send(
    channel: NotificationChannelName,
    binding: EventBinding,
    to: string,
    variables: Record<string, unknown>,
    opts: {
      communityId: string | null;
      tenantId?: string | null;
      template?: string;
      metadata: Record<string, unknown>;
      dedupeKey: string;
    },
  ): Promise<void> {
    const template = opts.template ?? binding.template;
    const ctx = {
      tenantId: opts.tenantId,
      communityId: opts.communityId,
      metadata: opts.metadata,
      dedupeKey: `${opts.dedupeKey}:${template}:${channel}:${to}`,
    };
    const override = opts.template
      ? null
      : await this.preferences.templateFor(opts.communityId, binding.event, channel);

    let rendered;
    try {
      rendered = await this.renderer.render({
        template, channel, variables, communityId: opts.communityId, override,
      });
    } catch (err) {
      // A custom body stored before the safety check existed falls back to the
      // default wording rather than dropping the message.
      if (override && err instanceof UnsafeTemplateError) {
        this.logger.warn(`Ignoring unsafe custom template for ${binding.event}/${channel}: ${err.message}`);
        rendered = await this.renderer
          .render({ template, channel, variables, communityId: opts.communityId })
          .catch((e: unknown) => e as Error);
      } else {
        rendered = err as Error;
      }
    }
    if (rendered instanceof Error) {
      const reason = rendered instanceof MissingVariablesError
        ? `Not sent: missing ${rendered.missing.join(', ')}`
        : `Not sent: ${rendered.message}`;
      this.logger.warn(`${binding.event}/${channel} (${template}) ${reason}`);
      await this.dispatcher.recordRefused(channel, to, reason, { ...ctx, template });
      return;
    }

    await this.dispatcher.dispatch(
      {
        channel,
        to,
        subject: rendered.subject,
        html: channel === 'email' ? rendered.html : undefined,
        text: rendered.text,
        fromName: rendered.brand.branded ? rendered.brand.sender_name : undefined,
      },
      { ...ctx, template: override ? `${binding.event}:custom` : template },
    );
  }

  /**
   * Load whatever the message needs from the records themselves — the event
   * payload only says what changed. Kept in one place so a template's values
   * are obvious; a missing row skips the notification rather than throwing.
   */
  private async contextFor(event: DomainEvent): Promise<RoutedMessage[] | null> {
    const communityId = event.communityId ?? undefined;
    const tz = (await this.branding.for(communityId)).timezone;
    const residentLink = (path: string) =>
      `${this.links.resident}${path}${communityId ? `?c=${communityId}` : ''}`;
    const workforceLink = (path: string) => `${this.links.workforce}${path}`;

    switch (event.name) {
      case DomainEventName.PaymentSucceeded:
      case DomainEventName.PaymentRecorded: {
        // Both are written only once the money is in: the gateway-verified
        // success path, or an admin recording cash/cheque/NEFT they collected.
        const payment = await this.prisma.payment.findUnique({
          where: { id: event.entityId },
          include: { invoice: { select: { invoiceNumber: true } } },
        });
        if (!payment) return null;
        // An online payment thanks whoever paid; a recorded one tells the unit's
        // owners — the people billed — that their dues were received.
        const residentIds = event.name === DomainEventName.PaymentRecorded
          ? (payment.unitId ? await this.ownership.notifiableResidentsFor(payment.unitId) : [])
          : payment.residentId ? [payment.residentId] : [];
        if (residentIds.length === 0) return null;
        const purpose = payment.purpose === 'MAINTENANCE'
          ? `Maintenance${payment.invoice?.invoiceNumber ? ` — ${payment.invoice.invoiceNumber}` : ''}`
          : 'Service payment';
        return residentIds.map((residentId) => ({
          recipient: { residentId, communityId },
          variables: {
            amount: this.money(payment.amount, payment.currency),
            payment_purpose: purpose,
            payment_date: formatDate(payment.paidAt, tz),
            payment_method: payment.method ? statusLabel(payment.method) : '',
            transaction_reference: payment.gatewayPaymentId ?? payment.receiptNumber,
            receipt_number: payment.receiptNumber,
            receipt_link: residentLink('/maintenance'),
          },
        }));
      }

      case DomainEventName.VisitorCreated:
      case DomainEventName.VisitorApproved: {
        const visitor = await this.prisma.visitor.findUnique({
          where: { id: event.entityId },
          include: {
            resident: {
              select: {
                firstName: true,
                lastName: true,
                unitAssignment: { select: { unit: { select: { unitNumber: true } } } },
              },
            },
          },
        });
        if (!visitor?.residentId) return null;
        const variables = {
          visitor_name: visitor.visitorName,
          pass_code: visitor.passCode,
          visit_date: formatDate(visitor.expectedArrival, tz, 'date'),
          arrival_time: formatDate(visitor.expectedArrival, tz, 'time'),
          visitor_pass_link: residentLink('/visitors'),
        };
        const messages: RoutedMessage[] = [
          { recipient: { residentId: visitor.residentId, communityId }, variables },
        ];

        // A PENDING visit is useless until someone with the authority to approve
        // it knows it exists — the resident already has their pass, the gate desk
        // has nothing. Fan out to the community's approvers.
        if (event.name === DomainEventName.VisitorCreated && communityId) {
          const host = visitor.resident
            ? `${visitor.resident.firstName} ${visitor.resident.lastName}`.trim()
            : 'A resident';
          const unitNumber = visitor.resident?.unitAssignment?.unit?.unitNumber ?? '';
          for (const approver of await this.approversFor(communityId)) {
            messages.push({
              recipient: { userId: approver.id, email: approver.email, name: approver.firstName },
              variables: {
                ...variables,
                recipient_name: approver.firstName,
                host_name: host,
                unit_number: unitNumber,
                approval_link: `${this.links.portal}/visitors/${visitor.id}`,
              },
              template: NOTIFICATION_TEMPLATES.VISITOR_PENDING,
            });
          }
        }
        return messages;
      }

      case DomainEventName.BookingCreated: {
        const booking = await this.prisma.amenityBooking.findUnique({
          where: { id: event.entityId },
          include: { amenity: { select: { name: true } } },
        });
        if (!booking?.residentId) return null;
        return [{
          recipient: { residentId: booking.residentId, communityId },
          variables: {
            facility_name: booking.amenity?.name ?? '',
            booking_date: formatDate(booking.startTime, tz, 'date'),
            time_slot: `${formatDate(booking.startTime, tz, 'time')} – ${formatDate(booking.endTime, tz, 'time')}`,
            booking_status: statusLabel(booking.status),
            booking_link: residentLink('/bookings'),
          },
        }];
      }

      case DomainEventName.ResidentCreated: {
        const resident = await this.prisma.resident.findUnique({
          where: { id: event.entityId },
          select: { id: true, firstName: true, mobile: true },
        });
        if (!resident) return null;
        return [{
          recipient: { residentId: resident.id, communityId },
          variables: {
            recipient_name: resident.firstName,
            username: resident.mobile,
            app_link: residentLink('/'),
          },
        }];
      }

      case DomainEventName.TicketCreated:
      case DomainEventName.TicketAssigned:
      case DomainEventName.TicketStatusChanged: {
        const ticket = await this.prisma.ticket.findUnique({
          where: { id: event.entityId },
          select: {
            number: true, title: true, description: true, status: true, residentId: true,
            createdAt: true, assignedAt: true, assignedStaffId: true, assignedVendorId: true,
            unit: { select: { unitNumber: true } },
          },
        });
        if (!ticket) return null;

        const base = {
          ticket_number: formatTicketNumber(ticket.number),
          ticket_title: ticket.title,
          ticket_description: ticket.description,
        };

        // On assignment the assignee is the audience; otherwise it is the
        // resident who raised it and is waiting to hear back.
        if (event.name === DomainEventName.TicketAssigned) {
          const assignee = this.assigneeRef(ticket, communityId);
          if (!assignee) return null;
          return [{
            recipient: assignee,
            variables: {
              ...base,
              unit_number: ticket.unit?.unitNumber ?? '',
              assigned_at: formatDate(ticket.assignedAt ?? event.occurredAt, tz),
              ticket_link: workforceLink(`/jobs/ticket/${event.entityId}`),
            },
          }];
        }

        if (!ticket.residentId) return null;
        const ticketLink = residentLink(`/requests/ticket/${event.entityId}`);
        if (event.name === DomainEventName.TicketCreated) {
          return [{
            recipient: { residentId: ticket.residentId, communityId },
            variables: {
              ...base,
              created_at: formatDate(ticket.createdAt, tz),
              status: statusLabel(ticket.status),
              ticket_link: ticketLink,
            },
          }];
        }

        // The event says what changed; the row may already have moved on, so
        // the transition is read from the event, not the current status.
        const data = event.data as { status?: string; fromStatus?: string; note?: string };
        const to = data.status ?? ticket.status;
        return [{
          recipient: { residentId: ticket.residentId, communityId },
          variables: {
            ...base,
            previous_status: statusLabel(data.fromStatus),
            status: statusLabel(to),
            update_description: ticketUpdateDescription(data.fromStatus, to, data.note),
            updated_at: formatDate(event.occurredAt, tz),
            ticket_link: ticketLink,
          },
        }];
      }

      case DomainEventName.ServiceAssigned:
      case DomainEventName.ServiceCompleted: {
        const request = await this.prisma.serviceRequest.findUnique({
          where: { id: event.entityId },
          select: {
            number: true, title: true, residentId: true, preferredDate: true, preferredTimeSlot: true,
            assignedStaffId: true, assignedVendorId: true,
            unit: { select: { unitNumber: true } },
          },
        });
        if (!request) return null;

        const base = {
          request_number: formatServiceRequestNumber(request.number),
          service_title: request.title,
        };

        if (event.name === DomainEventName.ServiceAssigned) {
          const assignee = this.assigneeRef(request, communityId);
          if (!assignee) return null;
          const date = formatDate(request.preferredDate, tz, 'date');
          return [{
            recipient: assignee,
            variables: {
              ...base,
              unit_number: request.unit?.unitNumber ?? '',
              scheduled_date: [date, request.preferredTimeSlot].filter(Boolean).join(', '),
              request_link: workforceLink(`/jobs/service-request/${event.entityId}`),
            },
          }];
        }

        if (!request.residentId) return null;
        return [{
          recipient: { residentId: request.residentId, communityId },
          variables: {
            ...base,
            status: 'Completed',
            update_description: 'Your service request has been completed. Please let us know if anything still needs attention.',
            request_link: residentLink(`/requests/service/${event.entityId}`),
          },
        }];
      }

      /**
       * The approval lane speaks to the RESIDENT waiting on the ticket, plus
       * the approvers who have to decide. Staff already know — they raised it.
       */
      case DomainEventName.WorkOrderRecommended:
      case DomainEventName.WorkOrderApproved:
      case DomainEventName.WorkOrderRejected: {
        const workOrder = await this.prisma.workOrder.findUnique({
          where: { id: event.entityId },
          select: {
            number: true, title: true, originType: true, originId: true, dueDate: true,
            estimatedTotalCost: true,
          },
        });
        if (!workOrder) return null;

        const lane = {
          [DomainEventName.WorkOrderRecommended]: {
            status: 'Awaiting Approval',
            text: 'Additional work is needed on your request and is awaiting approval. We will update you as soon as it is decided.',
          },
          [DomainEventName.WorkOrderApproved]: {
            status: 'Approved',
            text: 'The additional work has been approved and work on your request is resuming.',
          },
          [DomainEventName.WorkOrderRejected]: {
            status: 'Not Approved',
            text: 'The additional work was not approved. Our team is continuing with your original request.',
          },
        }[event.name];

        const variables = {
          work_order_number: formatWorkOrderNumber(workOrder.number),
          work_title: workOrder.title,
          status: lane.status,
          update_description: lane.text,
          expected_completion: formatDate(workOrder.dueDate, tz, 'date'),
        };

        const messages: RoutedMessage[] = [];

        // The resident whose ticket is parked on this decision.
        if (workOrder.originType === 'TICKET' && workOrder.originId) {
          const ticket = await this.prisma.ticket.findUnique({
            where: { id: workOrder.originId },
            select: { residentId: true },
          });
          if (ticket?.residentId) {
            messages.push({
              recipient: { residentId: ticket.residentId, communityId },
              variables: {
                ...variables,
                work_order_link: residentLink(`/requests/ticket/${workOrder.originId}`),
              },
            });
          }
        }

        // Only a pending decision needs an approver; the outcomes do not.
        if (event.name === DomainEventName.WorkOrderRecommended && communityId) {
          const cost = workOrder.estimatedTotalCost
            ? ` The estimated cost is ${this.money(workOrder.estimatedTotalCost)}.`
            : '';
          for (const approver of await this.approversFor(communityId, PERMISSIONS.WORKORDER_APPROVE)) {
            messages.push({
              recipient: { userId: approver.id, email: approver.email, name: approver.firstName },
              variables: {
                ...variables,
                recipient_name: approver.firstName,
                update_description: `This work order is waiting on your approval.${cost}`,
                work_order_link: `${this.links.portal}/work-orders/${event.entityId}`,
              },
            });
          }
        }
        return messages.length > 0 ? messages : null;
      }

      case DomainEventName.WorkOrderAssigned:
      case DomainEventName.WorkCompleted: {
        const workOrder = await this.prisma.workOrder.findUnique({
          where: { id: event.entityId },
          select: {
            number: true, title: true, assignedAt: true, dueDate: true, completedDate: true,
            assignedStaffId: true, assignedVendorId: true,
          },
        });
        if (!workOrder) return null;

        // A work order has no resident — it is internal work. On completion the
        // audience is whoever did it, so they get the confirmation they raised.
        const assignee = this.assigneeRef(workOrder, communityId);
        if (!assignee) return null;

        const base = {
          work_order_number: formatWorkOrderNumber(workOrder.number),
          work_title: workOrder.title,
          work_order_link: workforceLink(`/jobs/work-order/${event.entityId}`),
        };
        if (event.name === DomainEventName.WorkOrderAssigned) {
          return [{
            recipient: assignee,
            variables: {
              ...base,
              assigned_at: formatDate(workOrder.assignedAt ?? event.occurredAt, tz),
              scheduled_date: formatDate(workOrder.dueDate, tz, 'date'),
            },
          }];
        }
        // WorkCompleted is only published once the work order IS completed.
        return [{
          recipient: assignee,
          variables: {
            ...base,
            status: 'Completed',
            update_description: `This work order was marked as completed on ${formatDate(workOrder.completedDate ?? event.occurredAt, tz)}.`,
          },
        }];
      }

      default:
        return null;
    }
  }

  /**
   * A published announcement reaches every resident with an app login as an
   * in-app banner (if the app is open) and a push notification — never email
   * or WhatsApp, which would be a message to the whole community at once.
   * The event's on/off switch in Notification preferences still applies.
   */
  private async announce(event: DomainEvent): Promise<void> {
    if (!event.communityId) return;
    if (!(await this.preferences.isEnabled(event.communityId, NotificationEvent.ANNOUNCEMENT))) return;
    const announcement = await this.prisma.announcement.findFirst({
      where: { id: event.entityId, communityId: event.communityId, deletedAt: null },
      select: { id: true, title: true, content: true },
    });
    if (!announcement) return;
    const residents = await this.prisma.resident.findMany({
      where: { communityId: event.communityId, status: 'ACTIVE', deletedAt: null, userId: { not: null } },
      select: { userId: true },
    });
    const userIds = [...new Set(residents.map((r) => r.userId!))];
    if (userIds.length === 0) return;

    const flat = announcement.content.replace(/\s+/g, ' ').trim();
    const summary = flat.length > 140 ? `${flat.slice(0, 137).trimEnd()}…` : flat;
    const occurred = new Date(event.occurredAt ?? Date.now()).toISOString();
    const BATCH = 500;
    for (let i = 0; i < userIds.length; i += BATCH) {
      const to = userIds.slice(i, i + BATCH);
      for (const channel of ['inapp', 'push'] as const) {
        await this.dispatcher
          .dispatch(
            {
              channel,
              to,
              subject: announcement.title,
              text: summary,
              channelData: {
                realtimeType: 'announcement.published',
                announcementId: announcement.id,
                url: '/announcements',
                tag: `announcement-${announcement.id}`,
              },
            },
            {
              tenantId: event.tenantId,
              communityId: event.communityId,
              template: NOTIFICATION_TEMPLATES.ANNOUNCEMENT,
              metadata: { domainEvent: event.name, entityId: event.entityId },
              dedupeKey: `${event.name}:${announcement.id}:${occurred}:${channel}:${i / BATCH}`,
            },
          )
          .catch((err: Error) => this.logger.warn(`Announcement ${channel} failed: ${err.message}`));
      }
    }
  }

  private money(amount: unknown, currency?: string | null): string {
    const n = Number(amount);
    return `${currency || this.currency} ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Staff XOR vendor — the two are mutually exclusive everywhere in the domain,
   * so the first one set is the assignee. Returns null when nothing is assigned
   * yet, which is a normal state and not an error.
   */
  private assigneeRef(
    row: { assignedStaffId: string | null; assignedVendorId: string | null },
    communityId: string | undefined,
  ): RecipientRef | null {
    if (row.assignedStaffId) return { staffId: row.assignedStaffId, communityId };
    if (row.assignedVendorId) return { vendorId: row.assignedVendorId, communityId };
    return null;
  }

  /**
   * Active users who may approve visitors in this community — the gate desk and
   * whoever manages it. Resolved from role grants rather than a hardcoded role
   * key, so a custom role holding `visitor:approve` is alerted too.
   */
  private async approversFor(communityId: string, permission: string = PERMISSIONS.VISITOR_APPROVE) {
    const grants = await this.prisma.userRole.findMany({
      where: {
        communityId,
        role: {
          permissions: { some: { permission: { key: permission } } },
        },
        user: { status: 'ACTIVE', deletedAt: null },
      },
      select: { user: { select: { id: true, email: true, firstName: true } } },
      take: 25,
    });
    // One person can hold several qualifying roles — send once.
    return [...new Map(grants.map((g) => [g.user.id, g.user])).values()];
  }

  /**
   * Send the maintenance-due reminder for a set of invoices. Called by the
   * billing scheduler (which knows *which* bills are due) rather than inferred
   * from the generation event, so each resident gets their own message.
   */
  async sendMaintenanceDue(
    invoices: Array<{
      id: string;
      communityId: string;
      unitId: string;
      residentId: string | null;
      invoiceNumber: string;
      totalAmount: unknown;
      paidAmount: unknown;
      dueDate: Date;
    }>,
  ): Promise<number> {
    let sent = 0;
    const binding = {
      event: NotificationEvent.MAINTENANCE_DUE,
      template: NOTIFICATION_TEMPLATES.MAINTENANCE_DUE,
    };
    // The sweep runs daily: one reminder per invoice per day, however often it runs.
    const today = new Date().toISOString().slice(0, 10);
    for (const invoice of invoices) {
      /*
        Addressed to the people who OWE the money, resolved from the unit.

        This sent to `invoice.residentId`, which was whichever occupancy row
        sorted first — so a tenant was chased for their landlord's bill by
        WhatsApp, email and push. Ownership answers it properly, returns every
        co-owner of a jointly-held flat, and returns nobody rather than a
        tenant when the owner is not yet on record.
      */
      const residentIds = await this.ownership.notifiableResidentsFor(invoice.unitId);
      if (residentIds.length === 0) continue;
      const routing = await this.preferences.resolve(invoice.communityId, binding.event);
      if (!routing.enabled) continue;

      const unit = await this.prisma.unit.findUnique({
        where: { id: invoice.unitId },
        select: { unitNumber: true },
      });
      const tz = (await this.branding.for(invoice.communityId)).timezone;
      const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      const variables = {
        invoice_number: invoice.invoiceNumber,
        amount: this.money(balance),
        due_date: formatDate(invoice.dueDate, tz, 'date'),
        billing_period: invoice.dueDate.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: tz }),
        unit_number: unit?.unitNumber ?? '',
        payment_link: `${this.links.resident}/maintenance?c=${invoice.communityId}`,
      };

      for (const residentId of residentIds) {
        for (const channel of routing.channels) {
          const contact = await this.recipients.contact(channel, {
            residentId,
            communityId: invoice.communityId,
          });
          if (!contact.address) continue;
          await this.send(channel, binding, contact.address, { ...variables, recipient_name: contact.name }, {
            communityId: invoice.communityId,
            metadata: { invoiceId: invoice.id },
            dedupeKey: `maintenance-due:${invoice.id}:${today}`,
          })
            .then(() => {
              sent += 1;
            })
            .catch((err: Error) => {
              this.logger.warn(`Maintenance reminder failed for ${invoice.id}: ${err.message}`);
            });
        }
      }
    }
    return sent;
  }
}
