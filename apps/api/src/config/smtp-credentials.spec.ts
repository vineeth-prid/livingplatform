import { configuration } from './configuration';

/**
 * SMTP credentials must survive the env-var alias.
 *
 * `SMTP_USERNAME` and `SMTP_USER` both have a class default of `''` in
 * env.validation, so the validated object always carries an empty string rather
 * than undefined. Chaining them with `??` therefore never fell through:
 * configuring SMTP_USER left the username empty, nodemailer received
 * `auth: undefined`, the session never authenticated, and the mail host refused
 * to relay with "554 5.7.1 Client host rejected: Access denied" — a message
 * about the CLIENT that says nothing about credentials being dropped in transit.
 *
 * The bug is invisible to types and to every test that sets the modern name, so
 * it is pinned on the legacy one.
 */
describe('SMTP credential resolution', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  function smtpConfig(vars: Record<string, string>) {
    process.env = { ...original, ...vars };
    return configuration().email.smtp;
  }

  it('uses SMTP_USER when only the legacy name is set', () => {
    const smtp = smtpConfig({
      SMTP_HOST: 'smtp.hostinger.com',
      SMTP_USER: 'notifications@example.com',
      SMTP_PASSWORD: 'secret',
      SMTP_USERNAME: '',
    });

    expect(smtp.username).toBe('notifications@example.com');
  });

  it('prefers SMTP_USERNAME when both are set', () => {
    const smtp = smtpConfig({
      SMTP_USERNAME: 'modern@example.com',
      SMTP_USER: 'legacy@example.com',
    });

    expect(smtp.username).toBe('modern@example.com');
  });

  it('is empty only when neither is configured', () => {
    const smtp = smtpConfig({ SMTP_USERNAME: '', SMTP_USER: '' });

    expect(smtp.username).toBe('');
  });

  it('treats port 465 as implicit TLS without needing SMTP_SECURE', () => {
    // Hostinger and most providers publish 465; getting this wrong produces a
    // hang rather than an error, because the server waits for a TLS handshake
    // that never comes.
    expect(smtpConfig({ SMTP_PORT: '465' }).secure).toBe(true);
    expect(smtpConfig({ SMTP_PORT: '587' }).secure).toBe(false);
    expect(smtpConfig({ SMTP_PORT: '587', SMTP_SECURE: 'true' }).secure).toBe(true);
  });
});
