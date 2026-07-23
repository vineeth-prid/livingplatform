import { Readable } from 'node:stream';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { AppConfig } from '../../../config/configuration';
import { NOTIFICATION_JOB, NOTIFICATION_QUEUE, type NotificationTemplateName } from '../notification.constants';
import { ChannelRouter } from './channel-router';
import { DeliveryTracker } from './delivery-tracker';
import { EmailTemplateEngine } from './templates/template.engine';
import type {
  ChannelHealth, DeliveryResult, NotificationAttachment, NotificationChannelName, NotificationMessage,
} from './notification-channel.interface';

export interface DispatchContext {
  template?: string;
  locale?: string;
  tenantId?: string | null;
  communityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Serialized job payload (Redis-safe — buffers become base64). */
export interface NotificationJobData {
  deliveryId: string;
  channel: NotificationChannelName;
  message: NotificationMessage;
}

/**
 * The heart of the Notification Engine. Business/notification code calls the
 * dispatcher; it renders templates, resolves the target channel, enqueues to the
 * ONE shared notification queue (async by default), and tracks delivery. It
 * owns NO channel logic and NO business logic — it routes and orchestrates.
 * (Extracted from the Email sprint's EmailService orchestration.)
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private readonly attempts: number;
  private readonly defaultLocale: string;

  constructor(
    private readonly router: ChannelRouter,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue<NotificationJobData>,
    private readonly tracking: DeliveryTracker,
    private readonly templates: EmailTemplateEngine,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    const email = this.config.get('email', { infer: true });
    this.attempts = email.queue.attempts;
    this.defaultLocale = email.defaultLocale;
  }

  /** Enqueue a message for asynchronous delivery on its channel. */
  async dispatch(message: NotificationMessage, ctx: DispatchContext = {}): Promise<{ deliveryId: string; jobId: string }> {
    this.assertMessage(message);
    const channel = this.router.get(message.channel);
    const serialized = serializeMessage(message);
    const deliveryId = await this.tracking.createQueued(message, {
      channel: message.channel,
      provider: channel.provider,
      maxAttempts: this.attempts,
      subject: message.subject,
      template: ctx.template,
      locale: ctx.locale,
      tenantId: ctx.tenantId,
      communityId: ctx.communityId,
      metadata: ctx.metadata,
    });
    const job = await this.queue.add(
      NOTIFICATION_JOB,
      { deliveryId, channel: message.channel, message: serialized },
      { attempts: this.attempts, backoff: { type: 'custom' }, removeOnComplete: 1000, removeOnFail: false },
    );
    await this.tracking.attachJob(deliveryId, job.id ?? '');
    this.log('queued', { deliveryId, jobId: job.id, channel: message.channel, subject: message.subject });
    return { deliveryId, jobId: job.id ?? '' };
  }

  /** Send immediately, bypassing the queue (still tracked). Supports streams. */
  async dispatchNow(message: NotificationMessage, ctx: DispatchContext = {}): Promise<DeliveryResult> {
    this.assertMessage(message);
    const channel = this.router.get(message.channel);
    const deliveryId = await this.tracking.createQueued(message, {
      channel: message.channel,
      provider: channel.provider,
      maxAttempts: 1,
      subject: message.subject,
      template: ctx.template,
      locale: ctx.locale,
      tenantId: ctx.tenantId,
      communityId: ctx.communityId,
      metadata: ctx.metadata,
    });
    return this.deliver({ deliveryId, channel: message.channel, message });
  }

  /**
   * Render a template and dispatch it on a channel. Email consumes the rendered
   * html+text; text-only channels (WhatsApp) consume the plain text. One event →
   * one template → any channel.
   */
  async dispatchTemplate(
    channel: NotificationChannelName,
    template: NotificationTemplateName | string,
    to: string | string[],
    variables: Record<string, unknown> = {},
    opts: { locale?: string; cc?: string | string[]; bcc?: string | string[]; replyTo?: string; attachments?: NotificationAttachment[]; channelData?: Record<string, unknown>; ctx?: DispatchContext } = {},
  ): Promise<{ deliveryId: string; jobId: string }> {
    const locale = opts.locale ?? this.defaultLocale;
    const rendered = this.templates.render(template, variables, locale);
    return this.dispatch(
      {
        channel, to, cc: opts.cc, bcc: opts.bcc, replyTo: opts.replyTo,
        subject: rendered.subject, html: rendered.html, text: rendered.text,
        attachments: opts.attachments, channelData: opts.channelData,
      },
      { ...opts.ctx, template, locale },
    );
  }

  /** Render a diagnostic test message and send it immediately on a channel. */
  async dispatchTest(channel: NotificationChannelName, to: string): Promise<DeliveryResult> {
    const provider = this.router.get(channel).provider;
    const rendered = this.templates.render('generic', {
      subject: 'Living notification test',
      heading: 'It works 🎉',
      bodyHtml: `<p>Test notification from the Living Notification Engine on the <strong>${channel.toUpperCase()}</strong> channel via <strong>${provider.toUpperCase()}</strong>.</p><p class="muted">Sent at ${new Date().toISOString()}.</p>`,
    }, this.defaultLocale);
    return this.dispatchNow(
      { channel, to, subject: rendered.subject, html: rendered.html, text: rendered.text },
      { template: 'generic', metadata: { test: true } },
    );
  }

  /** Transmit via the channel and record the result. Called by the queue worker
   *  (per attempt) and by dispatchNow. Throws on failure so the worker retries. */
  async deliver(data: NotificationJobData, retryCount = 0): Promise<DeliveryResult> {
    const start = Date.now();
    const channel = this.router.get(data.channel);
    await this.tracking.markProcessing(data.deliveryId);
    try {
      const message = deserializeMessage(data.message);
      const result = await channel.send(message);
      const durationMs = Date.now() - start;
      await this.tracking.markSent(data.deliveryId, {
        providerMessageId: result.messageId,
        providerResponse: result.raw,
        durationMs,
        retryCount,
      });
      this.log('sent', { deliveryId: data.deliveryId, channel: data.channel, provider: result.provider, messageId: result.messageId, durationMs, retryCount });
      return result;
    } catch (err) {
      this.log('error', { deliveryId: data.deliveryId, channel: data.channel, retryCount, error: (err as Error).message });
      throw err;
    }
  }

  verify(channel: NotificationChannelName): Promise<boolean> {
    return this.router.get(channel).verify();
  }

  health(channel: NotificationChannelName): Promise<ChannelHealth> {
    return this.router.get(channel).health();
  }

  private assertMessage(message: NotificationMessage): void {
    const to = Array.isArray(message.to) ? message.to : [message.to];
    if (to.filter(Boolean).length === 0) throw new BadRequestException('A notification requires at least one recipient');
    // Email needs subject + body; other channels validate their own shape in send().
    if (message.channel === 'email') {
      if (!message.subject) throw new BadRequestException('An email requires a subject');
      if (!message.html && !message.text) throw new BadRequestException('An email requires html or text content');
    }
  }

  private log(status: string, fields: Record<string, unknown>): void {
    this.logger.log({ event: 'notification', status, ...fields });
  }
}

// ── Message (de)serialization for the queue ──────────────────────────────────

function serializeMessage(message: NotificationMessage): NotificationMessage {
  if (!message.attachments?.length) return message;
  return {
    ...message,
    attachments: message.attachments.map((a) => {
      if (a.content instanceof Readable) {
        throw new BadRequestException('Stream attachments cannot be queued — use dispatchNow() for streams');
      }
      if (Buffer.isBuffer(a.content)) return { ...a, content: a.content.toString('base64'), encoding: 'base64' };
      return a;
    }),
  };
}

function deserializeMessage(message: NotificationMessage): NotificationMessage {
  if (!message.attachments?.length) return message;
  return {
    ...message,
    attachments: message.attachments.map((a) =>
      a.encoding === 'base64' && typeof a.content === 'string'
        ? { ...a, content: Buffer.from(a.content, 'base64'), encoding: undefined }
        : a,
    ),
  };
}
