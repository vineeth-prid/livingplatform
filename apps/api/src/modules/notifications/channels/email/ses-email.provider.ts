import { Logger } from '@nestjs/common';
import {
  GetSendQuotaCommand, SESClient, SendRawEmailCommand,
} from '@aws-sdk/client-ses';
import MailComposer from 'nodemailer/lib/mail-composer';

import type {
  EmailAttachment, EmailMessage, EmailProvider, HealthResult, SendResult,
} from './email-provider.interface';

export interface SesProviderConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  configurationSet: string;
}

/**
 * Amazon SES provider (AWS SDK v3). Composes a full MIME message with
 * Nodemailer's MailComposer and transmits it via SendRawEmail, so HTML + plain
 * text, CC, BCC, Reply-To, attachments (buffer/stream/path), custom headers and
 * multiple recipients are all supported through one code path.
 */
export class SesEmailProvider implements EmailProvider {
  readonly name = 'ses';
  private readonly logger = new Logger(SesEmailProvider.name);
  private readonly client: SESClient;
  private readonly from: string;

  constructor(private readonly config: SesProviderConfig) {
    this.from = `${config.fromName} <${config.fromEmail}>`;
    this.client = new SESClient({
      region: config.region,
      credentials: config.accessKeyId
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : undefined, // fall back to the AWS default credential chain (IAM role)
    });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const raw = await this.compose(message);
    const res = await this.client.send(
      new SendRawEmailCommand({
        RawMessage: { Data: raw },
        ...(this.config.configurationSet ? { ConfigurationSetName: this.config.configurationSet } : {}),
      }),
    );
    return { messageId: res.MessageId ?? null, provider: this.name, raw: { requestId: res.$metadata.requestId } };
  }

  async verify(): Promise<boolean> {
    await this.client.send(new GetSendQuotaCommand({}));
    return true;
  }

  async health(): Promise<HealthResult> {
    const start = Date.now();
    try {
      const quota = await this.client.send(new GetSendQuotaCommand({}));
      const exhausted = (quota.Max24HourSend ?? 0) > 0 && (quota.SentLast24Hours ?? 0) >= (quota.Max24HourSend ?? 0);
      return exhausted
        ? { state: 'unhealthy', provider: this.name, reason: '24h send quota exhausted', latencyMs: Date.now() - start }
        : { state: 'healthy', provider: this.name, latencyMs: Date.now() - start };
    } catch (err) {
      return { state: 'unhealthy', provider: this.name, reason: (err as Error).message, latencyMs: Date.now() - start };
    }
  }

  async close(): Promise<void> {
    this.client.destroy();
    this.logger.debug('SES client destroyed');
  }

  /** Build a raw MIME buffer with MailComposer (handles all envelope features). */
  private compose(message: EmailMessage): Promise<Buffer> {
    const composer = new MailComposer({
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
      attachments: message.attachments?.map((a: EmailAttachment) => ({
        filename: a.filename,
        content: a.content,
        path: a.path,
        contentType: a.contentType,
        cid: a.cid,
        encoding: a.encoding,
      })),
    });
    return new Promise((resolve, reject) => {
      composer.compile().build((err, msg) => (err ? reject(err) : resolve(msg)));
    });
  }
}
