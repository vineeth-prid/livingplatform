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
import { NotificationDispatcher } from './notification.dispatcher';
import { RecipientResolver, type RecipientRef } from './recipient-resolver';
import { EmailTemplateEngine } from './templates/template.engine';

/**
 * The seam that turns a DOMAIN event into NOTIFICATIONS.
 *
 * Business modules keep publishing plain domain events and know nothing about
 * channels; this router decides — per community preference — which channels an
 * event goes out on, resolves the recipient, and hands the message to the ONE
 * dispatcher. Adding a channel changes nothing here; adding an event is one row
 * in EVENT_MAP plus a template.
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
  [DomainEventName.InvoiceGenerated]: {
    event: NotificationEvent.MAINTENANCE_DUE,
    template: NOTIFICATION_TEMPLATES.MAINTENANCE_DUE,
  },
  [DomainEventName.PaymentSucceeded]: {
    event: NotificationEvent.PAYMENT_SUCCESS,
    template: NOTIFICATION_TEMPLATES.PAYMENT_SUCCESS,
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
  [DomainEventName.AnnouncementPublished]: {
    event: NotificationEvent.ANNOUNCEMENT,
    template: NOTIFICATION_TEMPLATES.ANNOUNCEMENT,
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
    template: NOTIFICATION_TEMPLATES.GENERIC,
  },
  [DomainEventName.WorkOrderAssigned]: {
    event: NotificationEvent.WORK_ORDER_ASSIGNED,
    template: NOTIFICATION_TEMPLATES.WORK_ORDER_ASSIGNED,
  },
  // The approval lane. A recommendation is a request for a decision, and both
  // outcomes change what the resident should expect — so all three notify.
  [DomainEventName.WorkOrderRecommended]: {
    event: NotificationEvent.WORK_ORDER_UPDATE,
    template: NOTIFICATION_TEMPLATES.GENERIC,
  },
  [DomainEventName.WorkOrderApproved]: {
    event: NotificationEvent.WORK_ORDER_UPDATE,
    template: NOTIFICATION_TEMPLATES.GENERIC,
  },
  [DomainEventName.WorkOrderRejected]: {
    event: NotificationEvent.WORK_ORDER_UPDATE,
    template: NOTIFICATION_TEMPLATES.GENERIC,
  },
  [DomainEventName.WorkCompleted]: {
    event: NotificationEvent.WORK_ORDER_UPDATE,
    template: NOTIFICATION_TEMPLATES.WORK_ORDER_COMPLETED,
  },
  [DomainEventName.ResidentCreated]: {
    event: NotificationEvent.WELCOME,
    template: NOTIFICATION_TEMPLATES.WELCOME,
  },
};

@Injectable()
export class NotificationRouterService {
  private readonly logger = new Logger(NotificationRouterService.name);
  private readonly webAppUrl: string;
  private readonly currency: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly preferences: NotificationPreferenceService,
    private readonly recipients: RecipientResolver,
    private readonly templates: EmailTemplateEngine,
    config: ConfigService<AppConfig, true>,
  ) {
    this.webAppUrl = config.get('webAppUrl', { infer: true });
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
    const routing = await this.preferences.resolve(event.communityId, binding.event);
    if (!routing.enabled) return;

    const messages = await this.contextFor(event);
    if (!messages?.length) return;

    for (const message of messages) {
      for (const channel of routing.channels) {
        const address = await this.recipients.resolve(channel, message.recipient);
        if (!address) continue;
        await this.send(channel, binding, address, message.variables, event, message.template);
      }
    }
  }

  /**
   * Send on one channel, preferring the community's own template body over the
   * platform default. Text-only channels (WhatsApp) get the plain-text render
   * of the same template, so one event → one message, any channel.
   *
   * `template` overrides the binding's default — used when one event addresses
   * two audiences that need to read different things (a visitor pass for the
   * resident, an approval request for the gate desk).
   */
  private async send(
    channel: NotificationChannelName,
    binding: EventBinding,
    to: string,
    variables: Record<string, unknown>,
    event: DomainEvent,
    template?: string,
  ): Promise<void> {
    const ctx = {
      tenantId: event.tenantId,
      communityId: event.communityId,
      metadata: { domainEvent: event.name, entityId: event.entityId },
    };

    // A community's custom body replaces the event's DEFAULT message only — it
    // was never written for the secondary audience.
    const override = template
      ? null
      : await this.preferences.templateFor(event.communityId, binding.event, channel);
    if (override) {
      const rendered = this.templates.renderRaw(override.body, variables, {
        subject: override.subject ?? undefined,
        layout: channel === 'email',
      });
      await this.dispatcher.dispatch(
        {
          channel,
          to,
          subject: rendered.subject || 'Living',
          html: channel === 'email' ? rendered.html : undefined,
          text: rendered.text,
        },
        { ...ctx, template: `${binding.event}:custom` },
      );
      return;
    }

    await this.dispatcher.dispatchTemplate(
      channel,
      template ?? binding.template,
      to,
      variables,
      { ctx },
    );
  }

  /**
   * Load whatever the message needs. Kept in one place so a template's
   * variables are obvious and a missing row silently skips the notification
   * rather than throwing inside an event handler.
   */
  private async contextFor(event: DomainEvent): Promise<RoutedMessage[] | null> {
    const communityId = event.communityId ?? undefined;

    switch (event.name) {
      case DomainEventName.InvoiceGenerated: {
        // A generation run notifies each invoice's resident individually; the
        // run-level event only carries a count, so fan out from the rows.
        return null;
      }

      case DomainEventName.PaymentSucceeded: {
        const payment = await this.prisma.payment.findUnique({
          where: { id: event.entityId },
          include: { invoice: { select: { invoiceNumber: true } } },
        });
        if (!payment?.residentId) return null;
        return [{
          recipient: { residentId: payment.residentId, communityId },
          variables: {
            amount: Number(payment.amount).toFixed(2),
            currency: payment.currency || this.currency,
            invoiceNumber: payment.invoice?.invoiceNumber ?? null,
            receiptNumber: payment.receiptNumber,
            paidAt: payment.paidAt?.toDateString() ?? '',
            residentName: '',
            actionUrl: `${this.webAppUrl}/payments/${payment.id}`,
          },
        }];
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
          visitorName: visitor.visitorName,
          passCode: visitor.passCode,
          expectedAt: visitor.expectedArrival.toLocaleString(),
          communityName: await this.communityName(communityId),
          residentName: '',
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
            : 'a resident';
          const unitNumber = visitor.resident?.unitAssignment?.unit?.unitNumber ?? null;
          for (const approver of await this.approversFor(communityId)) {
            messages.push({
              recipient: { userId: approver.id, email: approver.email, name: approver.firstName },
              variables: {
                ...variables,
                residentName: approver.firstName,
                hostName: host,
                unitNumber,
                visitorMobile: visitor.mobileNumber,
                actionUrl: `${this.webAppUrl}/visitors/${visitor.id}`,
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
            amenityName: booking.amenity?.name ?? 'Amenity',
            slotLabel: `${booking.startTime.toLocaleString()} – ${booking.endTime.toLocaleTimeString()}`,
            residentName: '',
          },
        }];
      }

      case DomainEventName.ResidentCreated: {
        const resident = await this.prisma.resident.findUnique({
          where: { id: event.entityId },
          select: { id: true, firstName: true, mobile: true, email: true },
        });
        if (!resident) return null;
        return [{
          recipient: { residentId: resident.id, communityId },
          variables: {
            residentName: resident.firstName,
            username: resident.mobile,
            communityName: await this.communityName(communityId),
            actionUrl: this.webAppUrl,
          },
        }];
      }

      case DomainEventName.TicketCreated:
      case DomainEventName.TicketAssigned:
      case DomainEventName.TicketStatusChanged: {
        const ticket = await this.prisma.ticket.findUnique({
          where: { id: event.entityId },
          select: {
            number: true, title: true, status: true, residentId: true,
            assignedStaffId: true, assignedVendorId: true,
          },
        });
        if (!ticket) return null;

        const ticketNumber = formatTicketNumber(ticket.number);
        const base = {
          ticketNumber,
          ticketTitle: ticket.title,
          title: ticket.title,
          communityName: await this.communityName(communityId),
          actionUrl: `${this.webAppUrl}/tickets/${event.entityId}`,
          ticketUrl: `${this.webAppUrl}/tickets/${event.entityId}`,
        };

        // On assignment the assignee is the audience; otherwise it is the
        // resident who raised it and is waiting to hear back.
        if (event.name === DomainEventName.TicketAssigned) {
          const assignee = this.assigneeRef(ticket, communityId);
          if (!assignee) return null;
          return [{ recipient: assignee, variables: { ...base, assigneeName: '', recipientName: '' } }];
        }

        if (!ticket.residentId) return null;
        return [{
          recipient: { residentId: ticket.residentId, communityId },
          variables: {
            ...base,
            recipientName: '',
            note: `Status: ${ticket.status.toLowerCase().replace(/_/g, ' ')}`,
          },
        }];
      }

      case DomainEventName.ServiceAssigned:
      case DomainEventName.ServiceCompleted: {
        const request = await this.prisma.serviceRequest.findUnique({
          where: { id: event.entityId },
          select: {
            number: true, title: true, residentId: true,
            assignedStaffId: true, assignedVendorId: true,
          },
        });
        if (!request) return null;

        const base = {
          requestNumber: formatServiceRequestNumber(request.number),
          title: request.title,
          communityName: await this.communityName(communityId),
          actionUrl: `${this.webAppUrl}/service-requests/${event.entityId}`,
        };

        if (event.name === DomainEventName.ServiceAssigned) {
          const assignee = this.assigneeRef(request, communityId);
          if (!assignee) return null;
          return [{ recipient: assignee, variables: { ...base, assigneeName: '' } }];
        }

        if (!request.residentId) return null;
        return [{
          recipient: { residentId: request.residentId, communityId },
          variables: {
            ...base,
            recipientName: '',
            heading: 'Your request is complete',
            bodyHtml: `<p>${base.title} (${base.requestNumber}) has been completed.</p>`,
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
            number: true, title: true, originType: true, originId: true,
            estimatedTotalCost: true, rejectionReason: true,
          },
        });
        if (!workOrder) return null;

        const number = formatWorkOrderNumber(workOrder.number);
        const heading =
          event.name === DomainEventName.WorkOrderRecommended
            ? 'Additional work needs approval'
            : event.name === DomainEventName.WorkOrderApproved
              ? 'Approved — work is resuming'
              : 'Approved to continue without the extra work';
        const body =
          event.name === DomainEventName.WorkOrderRecommended
            ? `<p>${workOrder.title} (${number}) needs approval before work can continue. We will update you as soon as it is decided.</p>`
            : event.name === DomainEventName.WorkOrderApproved
              ? `<p>${workOrder.title} (${number}) has been approved and work is resuming.</p>`
              : `<p>The additional work for ${workOrder.title} (${number}) was not approved. Our team is continuing with the original request.</p>`;

        const variables = {
          subject: `${heading} — ${number}`,
          heading,
          bodyHtml: body,
          workOrderNumber: number,
          title: workOrder.title,
          recipientName: '',
          actionUrl: `${this.webAppUrl}/work-orders/${event.entityId}`,
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
              variables,
            });
          }
        }

        // Only a pending decision needs an approver; the outcomes do not.
        if (event.name === DomainEventName.WorkOrderRecommended && communityId) {
          for (const approver of await this.approversFor(communityId, PERMISSIONS.WORKORDER_APPROVE)) {
            messages.push({
              recipient: { userId: approver.id, email: approver.email, name: approver.firstName },
              variables: {
                ...variables,
                recipientName: approver.firstName,
                bodyHtml:
                  `<p>${workOrder.title} (${number}) is waiting on your approval` +
                  `${workOrder.estimatedTotalCost ? ` — estimated ${this.currency} ${Number(workOrder.estimatedTotalCost).toFixed(2)}` : ''}.</p>`,
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
            number: true, title: true, completedDate: true,
            assignedStaffId: true, assignedVendorId: true,
          },
        });
        if (!workOrder) return null;

        // A work order has no resident — it is internal work. On completion the
        // audience is whoever did it, so they get the confirmation they raised.
        const assignee = this.assigneeRef(workOrder, communityId);
        if (!assignee) return null;

        const workOrderNumber = formatWorkOrderNumber(workOrder.number);
        return [{
          recipient: assignee,
          variables: {
            workOrderNumber,
            title: workOrder.title,
            communityName: await this.communityName(communityId),
            assigneeName: '',
            recipientName: '',
            completedAt: workOrder.completedDate?.toDateString() ?? new Date().toDateString(),
            actionUrl: `${this.webAppUrl}/work-orders/${event.entityId}`,
            workOrderUrl: `${this.webAppUrl}/work-orders/${event.entityId}`,
          },
        }];
      }

      default:
        return null;
    }
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

  private async communityName(communityId: string | undefined): Promise<string> {
    if (!communityId) return 'your community';
    const c = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { name: true },
    });
    return c?.name ?? 'your community';
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
      residentId: string | null;
      invoiceNumber: string;
      totalAmount: unknown;
      paidAmount: unknown;
      dueDate: Date;
    }>,
  ): Promise<number> {
    let sent = 0;
    for (const invoice of invoices) {
      if (!invoice.residentId) continue;
      const routing = await this.preferences.resolve(
        invoice.communityId,
        NotificationEvent.MAINTENANCE_DUE,
      );
      if (!routing.enabled) continue;

      const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
      const variables = {
        invoiceNumber: invoice.invoiceNumber,
        amount: balance.toFixed(2),
        currency: this.currency,
        dueDate: invoice.dueDate.toDateString(),
        periodLabel: invoice.dueDate.toLocaleString('en', { month: 'long', year: 'numeric' }),
        residentName: '',
        unitNumber: '',
        actionUrl: `${this.webAppUrl}/invoices/${invoice.id}`,
      };

      for (const channel of routing.channels) {
        const address = await this.recipients.resolve(channel, {
          residentId: invoice.residentId,
          communityId: invoice.communityId,
        });
        if (!address) continue;
        await this.dispatcher
          .dispatchTemplate(channel, NOTIFICATION_TEMPLATES.MAINTENANCE_DUE, address, variables, {
            ctx: { communityId: invoice.communityId, metadata: { invoiceId: invoice.id } },
          })
          .then(() => {
            sent += 1;
          })
          .catch((err: Error) => {
            this.logger.warn(`Maintenance reminder failed for ${invoice.id}: ${err.message}`);
          });
      }
    }
    return sent;
  }
}
