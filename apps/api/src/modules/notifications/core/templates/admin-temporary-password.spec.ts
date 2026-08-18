import { EmailTemplateEngine } from './template.engine';
import { NOTIFICATION_TEMPLATES } from '../../notification.constants';

/**
 * The engine throws for an unknown template, and MailService now awaits this one
 * rather than swallowing failures — so a missing or malformed file would turn
 * "reset and email the password" into a hard error at the moment an operator is
 * trying to recover a locked-out community admin. This is the check that the
 * name in the constants and the file on disk stay in step.
 */
describe('admin-temporary-password template', () => {
  const engine = new EmailTemplateEngine();
  const vars = {
    communityName: 'The Arbour',
    username: 'association@living.local',
    temporaryPassword: 'Xk7-tempPass',
    signInUrl: 'https://admin.example/login',
  };

  it('is registered under the name MailService dispatches', () => {
    expect(engine.list()).toContain(NOTIFICATION_TEMPLATES.ADMIN_TEMPORARY_PASSWORD);
  });

  it('renders the credential and where to use it', () => {
    const out = engine.render(NOTIFICATION_TEMPLATES.ADMIN_TEMPORARY_PASSWORD, vars);
    expect(out.subject).toContain('The Arbour');
    expect(out.html).toContain('Xk7-tempPass');
    expect(out.html).toContain('association@living.local');
    expect(out.html).toContain('https://admin.example/login');
  });

  it('says the password is single-use, so the recipient expects the change prompt', () => {
    const out = engine.render(NOTIFICATION_TEMPLATES.ADMIN_TEMPORARY_PASSWORD, vars);
    expect(out.text.toLowerCase()).toContain('must set a new one');
  });

  it('produces a plain-text part — some mail clients show only that', () => {
    const out = engine.render(NOTIFICATION_TEMPLATES.ADMIN_TEMPORARY_PASSWORD, vars);
    expect(out.text).toContain('Xk7-tempPass');
    expect(out.text).not.toContain('<strong>');
  });
});
