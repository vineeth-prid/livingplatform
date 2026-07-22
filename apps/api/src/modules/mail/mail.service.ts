import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import type { AppConfig } from '../../config/configuration';

/**
 * Transactional email. In local dev this points at Mailpit (SMTP catcher at
 * localhost:1025, UI at :8025). In production, point SMTP_* at a real provider.
 *
 * ponytail: raw HTML strings inline here — fine for the two foundation emails.
 * Swap for a template engine (mjml/react-email) once the template count grows.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly webAppUrl: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const mail = this.config.get('mail', { infer: true });
    this.from = mail.from;
    this.webAppUrl = this.config.get('webAppUrl', { infer: true });
    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.port === 465,
      auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
    });
  }

  async sendEmailVerification(to: string, token: string): Promise<void> {
    const link = `${this.webAppUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Confirm your email',
      `<p>Welcome to Living.</p>
       <p>Confirm your email to finish setting up your account.</p>
       <p><a href="${link}">Confirm email</a></p>
       <p>This link expires in 24 hours.</p>`,
    );
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const link = `${this.webAppUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(
      to,
      'Reset your password',
      `<p>We received a request to reset your password.</p>
       <p><a href="${link}">Choose a new password</a></p>
       <p>This link expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`,
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      // Never let a mail failure break the auth flow; log and move on.
      this.logger.error(`Failed to send "${subject}" to ${to}`, err as Error);
    }
  }
}
