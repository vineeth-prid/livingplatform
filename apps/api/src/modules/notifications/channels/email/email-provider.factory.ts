import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../../config/configuration';
import type { EmailProvider } from './email-provider.interface';
import { SesEmailProvider } from './ses-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';

/**
 * The single place that decides which concrete provider is live. Reads
 * EMAIL_PROVIDER and instantiates exactly one provider. Adding a future provider
 * (Postmark, Resend, SendGrid, Mailgun, MS Graph) means adding ONE case here —
 * nothing else in the application changes.
 */
export class EmailProviderFactory {
  private static readonly logger = new Logger(EmailProviderFactory.name);

  static create(config: ConfigService<AppConfig, true>, override?: string): EmailProvider {
    const email = config.get('email', { infer: true });
    const provider = (override ?? email.provider).toLowerCase();
    switch (provider) {
      case 'ses':
        return new SesEmailProvider(email.ses);
      case 'smtp':
        return EmailProviderFactory.smtp(config);
      default:
        EmailProviderFactory.logger.warn(`Unknown EMAIL_PROVIDER "${provider}", falling back to smtp`);
        return EmailProviderFactory.smtp(config);
    }
  }

  private static smtp(config: ConfigService<AppConfig, true>): EmailProvider {
    const email = config.get('email', { infer: true });
    return new SmtpEmailProvider({ ...email.smtp, fallbackFrom: config.get('mail', { infer: true }).from });
  }
}
