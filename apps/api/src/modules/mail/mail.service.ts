import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { EMAIL_TEMPLATES } from '../email/email.constants';
import { EmailService } from '../email/email.service';

/**
 * Transactional auth email (verification / password reset). A thin adapter over
 * the Notification Engine's EmailService — it owns the links, the engine owns
 * provider/template/queue/tracking. Kept as a stable seam so auth code is
 * unchanged; mail failures never break the auth flow (queued, best-effort).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly webAppUrl: string;

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    this.webAppUrl = this.config.get('webAppUrl', { infer: true });
  }

  async sendEmailVerification(to: string, token: string): Promise<void> {
    const verificationUrl = `${this.webAppUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
    await this.enqueue(EMAIL_TEMPLATES.EMAIL_VERIFICATION, to, { verificationUrl });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = `${this.webAppUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
    await this.enqueue(EMAIL_TEMPLATES.PASSWORD_RESET, to, { resetUrl });
  }

  private async enqueue(template: string, to: string, variables: Record<string, unknown>): Promise<void> {
    try {
      await this.email.sendTemplate(template, to, variables);
    } catch (err) {
      // Never let a mail failure break auth; log and move on.
      this.logger.error(`Failed to queue "${template}" to ${to}`, err as Error);
    }
  }
}
