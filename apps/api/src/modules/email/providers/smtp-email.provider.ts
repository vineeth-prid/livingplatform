import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

import type {
  EmailAttachment, EmailMessage, EmailProvider, HealthResult, SendResult,
} from './email-provider.interface';

export interface SmtpProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  /** Fallback From when SMTP_FROM_EMAIL is not set (legacy MAIL_FROM). */
  fallbackFrom: string;
}

/**
 * SMTP provider (Nodemailer). Supports SMTP auth, STARTTLS/SSL, HTML + plain
 * text, attachments (buffer/stream/path), Reply-To, CC/BCC, custom headers and
 * multiple recipients. `secure: true` = implicit TLS (465); otherwise STARTTLS
 * is negotiated automatically on 587/25.
 */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: SmtpProviderConfig) {
    this.from = config.fromEmail
      ? `${config.fromName} <${config.fromEmail}>`
      : config.fallbackFrom;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.username ? { user: config.username, pass: config.password } : undefined,
      // Let STARTTLS upgrade non-secure connections when the server offers it.
      requireTLS: !config.secure && config.port !== 25,
    });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const info = await this.transporter.sendMail({
      from: message.from ?? this.from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      replyTo: message.replyTo ?? (this.config.replyTo || undefined),
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
      priority: message.priority,
      attachments: message.attachments?.map(mapAttachment),
    });
    return { messageId: info.messageId ?? null, provider: this.name, raw: { accepted: info.accepted, rejected: info.rejected, response: info.response } };
  }

  async verify(): Promise<boolean> {
    await this.transporter.verify();
    return true;
  }

  async health(): Promise<HealthResult> {
    const start = Date.now();
    try {
      await this.transporter.verify();
      return { state: 'healthy', provider: this.name, latencyMs: Date.now() - start };
    } catch (err) {
      return { state: 'unhealthy', provider: this.name, reason: (err as Error).message, latencyMs: Date.now() - start };
    }
  }

  async close(): Promise<void> {
    this.transporter.close();
    this.logger.debug('SMTP transporter closed');
  }
}

function mapAttachment(a: EmailAttachment): Mail.Attachment {
  return {
    filename: a.filename,
    content: a.content,
    path: a.path,
    contentType: a.contentType,
    cid: a.cid,
    encoding: a.encoding,
  };
}
