import type { ConfigService } from '@nestjs/config';

import { EmailProviderFactory } from './email-provider.factory';
import { SesEmailProvider } from './ses-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';

function configFor(provider: string): ConfigService<Record<string, unknown>, true> {
  const email = {
    provider,
    defaultLocale: 'en',
    ses: { region: 'us-east-1', accessKeyId: 'AK', secretAccessKey: 'SK', fromName: 'Living', fromEmail: 'no-reply@living.local', replyTo: '', configurationSet: '' },
    smtp: { host: 'localhost', port: 1025, secure: false, username: '', password: '', fromName: 'Living', fromEmail: '', replyTo: '' },
    queue: { concurrency: 5, attempts: 5, backoffMs: [60000] },
  };
  const mail = { from: 'Living <no-reply@living.local>' };
  return {
    get: (key: string) => (key === 'email' ? email : key === 'mail' ? mail : undefined),
  } as unknown as ConfigService<Record<string, unknown>, true>;
}

describe('EmailProviderFactory', () => {
  it('builds the SMTP provider when EMAIL_PROVIDER=smtp', () => {
    expect(EmailProviderFactory.create(configFor('smtp'))).toBeInstanceOf(SmtpEmailProvider);
  });

  it('builds the SES provider when EMAIL_PROVIDER=ses', () => {
    expect(EmailProviderFactory.create(configFor('ses'))).toBeInstanceOf(SesEmailProvider);
  });

  it('honours a runtime override regardless of config', () => {
    expect(EmailProviderFactory.create(configFor('smtp'), 'ses')).toBeInstanceOf(SesEmailProvider);
  });

  it('falls back to SMTP for an unknown provider', () => {
    expect(EmailProviderFactory.create(configFor('carrier-pigeon'))).toBeInstanceOf(SmtpEmailProvider);
  });
});
