import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationEvent } from '@prisma/client';

import type { AppConfig } from '../../../config/configuration';
import { DomainEventName, type DomainEvent } from '../../events/domain-events';
import { PrismaService } from '../../prisma/prisma.service';
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

    const context = await this.contextFor(event);
    if (!context) return;

    for (const channel of routing.channels) {
      const address = await this.recipients.resolve(channel, context.recipient);
      if (!address) continue;
      await this.send(channel, binding, address, context.variables, event);
    }
  }

  /**
   * Send on one channel, preferring the community's own template body over the
   * platform default. Text-only channels (WhatsApp) get the plain-text render
   * of the same template, so one event → one message, any channel.
   */
  private async send(
    channel: NotificationChannelName,
    binding: EventBinding,
    to: string,
    variables: Record<string, unknown>,
    event: DomainEvent,
  ): Promise<void> {
    const ctx = {
      tenantId: event.tenantId,
      communityId: event.communityId,
      metadata: { domainEvent: event.name, entityId: event.entityId },
    };

    const override = await this.preferences.templateFor(event.communityId, binding.event, channel);
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

    await this.dispatcher.dispatchTemplate(channel, binding.template, to, variables, { ctx });
  }

  /**
   * Load whatever the message needs. Kept in one place so a template's
   * variables are obvious and a missing row silently skips the notification
   * rather than throwing inside an event handler.
   */
  private async contextFor(
    event: DomainEvent,
  ): Promise<{ recipient: RecipientRef; variables: Record<string, unknown> } | null> {
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
        return {
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
        };
      }

      case DomainEventName.VisitorCreated:
      case DomainEventName.VisitorApproved: {
        const visitor = await this.prisma.visitor.findUnique({ where: { id: event.entityId } });
        if (!visitor?.residentId) return null;
        return {
          recipient: { residentId: visitor.residentId, communityId },
          variables: {
            visitorName: visitor.visitorName,
            passCode: visitor.passCode,
            expectedAt: visitor.expectedArrival.toLocaleString(),
            communityName: await this.communityName(communityId),
            residentName: '',
          },
        };
      }

      case DomainEventName.BookingCreated: {
        const booking = await this.prisma.amenityBooking.findUnique({
          where: { id: event.entityId },
          include: { amenity: { select: { name: true } } },
        });
        if (!booking?.residentId) return null;
        return {
          recipient: { residentId: booking.residentId, communityId },
          variables: {
            amenityName: booking.amenity?.name ?? 'Amenity',
            slotLabel: `${booking.startTime.toLocaleString()} – ${booking.endTime.toLocaleTimeString()}`,
            residentName: '',
          },
        };
      }

      case DomainEventName.ResidentCreated: {
        const resident = await this.prisma.resident.findUnique({
          where: { id: event.entityId },
          select: { id: true, firstName: true, mobile: true, email: true },
        });
        if (!resident) return null;
        return {
          recipient: { residentId: resident.id, communityId },
          variables: {
            residentName: resident.firstName,
            username: resident.mobile,
            communityName: await this.communityName(communityId),
            actionUrl: this.webAppUrl,
          },
        };
      }

      default:
        // Ticket / service / work-order events address the assignee, which the
        // engines already notify directly. Routing them here would double-send,
        // so they stay bound for *preference* purposes only.
        return null;
    }
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
