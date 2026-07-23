import { Readable } from 'node:stream';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { AppConfig } from '../../config/configuration';
import { EMAIL_JOB, EMAIL_QUEUE, type EmailTemplateName } from './email.constants';
import { EmailProviderRegistry } from './email-provider.registry';
import { EmailTrackingService } from './email.tracking.service';
import { EmailTemplateEngine } from './templates/template.engine';
import type {
  EmailAttachment,
  EmailMessage,
  HealthResult,
  SendResult,
} from './providers/email-provider.interface';

/** Optional context carried alongside a message (never business logic). */
export interface EmailContext {
  template?: string;
  locale?: string;
  tenantId?: string | null;
  communityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Serialized job payload (Redis-safe — buffers become base64). */
export interface EmailJobData {
  deliveryId: string;
  message: EmailMessage;
  provider: string;
}

/**
 * The ONE façade every business/notification module uses to send email. It hides
 * the provider entirely, renders templates, enqueues to BullMQ (async by
 * default), tracks delivery, and exposes health/verify/test. It contains NO
 * business logic — it only sends what it is given.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly attempts: number;
  private readonly defaultLocale: string;

  constructor(
    private readonly registry: EmailProviderRegistry,
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJobData>,
    private readonly tracking: EmailTrackingService,
    private readonly templates: EmailTemplateEngine,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    const email = this.config.get('email', { infer: true });
    this.attempts = email.queue.attempts;
    this.defaultLocale = email.defaultLocale;
  }

  private get provider() {
    return this.registry.current;
  }

  get providerName(): string {
    return this.provider.name;
  }

  /** Enqueue an email for asynchronous delivery. Returns the delivery id. */
  async send(message: EmailMessage, ctx: EmailContext = {}): Promise<{ deliveryId: string; jobId: string }> {
    this.assertRecipients(message);
    const serialized = serializeMessage(message); // rejects live streams
    const deliveryId = await this.tracking.createQueued(message, {
      provider: this.provider.name,
      maxAttempts: this.attempts,
      template: ctx.template,
      locale: ctx.locale,
      tenantId: ctx.tenantId,
      communityId: ctx.communityId,
      metadata: ctx.metadata,
    });
    const job = await this.queue.add(
      EMAIL_JOB,
      { deliveryId, message: serialized, provider: this.provider.name },
      {
        attempts: this.attempts,
        backoff: { type: 'custom' },
        removeOnComplete: 1000,
        removeOnFail: false,
      },
    );
    await this.tracking.attachJob(deliveryId, job.id ?? '');
    this.log('queued', { deliveryId, jobId: job.id, subject: message.subject, to: message.to });
    return { deliveryId, jobId: job.id ?? '' };
  }

  /** Explicit alias for `send` — asynchronous, queue-backed. */
  queueEmail(message: EmailMessage, ctx?: EmailContext): Promise<{ deliveryId: string; jobId: string }> {
    return this.send(message, ctx);
  }

  /** Send immediately, bypassing the queue (still tracked). Supports streams. */
  async sendNow(message: EmailMessage, ctx: EmailContext = {}): Promise<SendResult> {
    this.assertRecipients(message);
    const deliveryId = await this.tracking.createQueued(message, {
      provider: this.provider.name,
      maxAttempts: 1,
      template: ctx.template,
      locale: ctx.locale,
      tenantId: ctx.tenantId,
      communityId: ctx.communityId,
      metadata: ctx.metadata,
    });
    return this.deliver({ deliveryId, message, provider: this.provider.name });
  }

  /**
   * Render a template and enqueue it. `to`, variables and locale in; the engine
   * produces subject/html/text. This is how notification code sends typed emails.
   */
  async sendTemplate(
    template: EmailTemplateName | string,
    to: string | string[],
    variables: Record<string, unknown> = {},
    opts: { locale?: string; cc?: string | string[]; bcc?: string | string[]; replyTo?: string; attachments?: EmailAttachment[]; ctx?: EmailContext } = {},
  ): Promise<{ deliveryId: string; jobId: string }> {
    const locale = opts.locale ?? this.defaultLocale;
    const rendered = this.templates.render(template, variables, locale);
    return this.send(
      {
        to, cc: opts.cc, bcc: opts.bcc, replyTo: opts.replyTo,
        subject: rendered.subject, html: rendered.html, text: rendered.text,
        attachments: opts.attachments,
      },
      { ...opts.ctx, template, locale },
    );
  }

  /** Send a diagnostic test email (immediate). Used from Platform Admin. */
  async sendTest(to: string): Promise<SendResult> {
    const rendered = this.templates.render('generic', {
      subject: 'Living email test',
      heading: 'It works 🎉',
      bodyHtml: `<p>This is a test email from the Living Notification Engine via the <strong>${this.provider.name.toUpperCase()}</strong> provider.</p><p class="muted">Sent at ${new Date().toISOString()}.</p>`,
    }, this.defaultLocale);
    return this.sendNow(
      { to, subject: rendered.subject, html: rendered.html, text: rendered.text },
      { template: 'generic', metadata: { test: true } },
    );
  }

  verify(): Promise<boolean> {
    return this.provider.verify();
  }

  health(): Promise<HealthResult> {
    return this.provider.health();
  }

  /**
   * Actually transmit via the provider and record the result. Called by the
   * queue worker (per attempt) and by sendNow. Throws on provider failure so the
   * worker can schedule a retry.
   */
  async deliver(data: EmailJobData, retryCount = 0): Promise<SendResult> {
    const start = Date.now();
    await this.tracking.markProcessing(data.deliveryId);
    try {
      const message = deserializeMessage(data.message);
      const result = await this.provider.send(message);
      const durationMs = Date.now() - start;
      await this.tracking.markSent(data.deliveryId, {
        providerMessageId: result.messageId,
        providerResponse: result.raw,
        durationMs,
        retryCount,
      });
      this.log('sent', { deliveryId: data.deliveryId, provider: result.provider, messageId: result.messageId, durationMs, retryCount });
      return result;
    } catch (err) {
      this.log('error', { deliveryId: data.deliveryId, retryCount, error: (err as Error).message });
      throw err;
    }
  }

  private assertRecipients(message: EmailMessage): void {
    const to = Array.isArray(message.to) ? message.to : [message.to];
    if (to.filter(Boolean).length === 0) throw new BadRequestException('An email requires at least one recipient');
    if (!message.subject) throw new BadRequestException('An email requires a subject');
    if (!message.html && !message.text) throw new BadRequestException('An email requires html or text content');
  }

  /** Structured log line — provider/recipient/subject/status/retry/duration. */
  private log(status: string, fields: Record<string, unknown>): void {
    this.logger.log({ event: 'email', provider: this.provider.name, status, ...fields });
  }
}

// ── Message (de)serialization for the queue ──────────────────────────────────

/** Buffers → base64 for JSON transport; live streams are rejected (use sendNow). */
function serializeMessage(message: EmailMessage): EmailMessage {
  if (!message.attachments?.length) return message;
  return {
    ...message,
    attachments: message.attachments.map((a) => {
      if (a.content instanceof Readable) {
        throw new BadRequestException('Stream attachments cannot be queued — use sendNow() for streams');
      }
      if (Buffer.isBuffer(a.content)) {
        return { ...a, content: a.content.toString('base64'), encoding: 'base64' };
      }
      return a;
    }),
  };
}

/** base64 strings → Buffers for the provider. */
function deserializeMessage(message: EmailMessage): EmailMessage {
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
