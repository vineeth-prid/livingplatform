import { EmailTemplateEngine } from './template.engine';

describe('EmailTemplateEngine', () => {
  const engine = new EmailTemplateEngine();

  it('discovers the on-disk templates', () => {
    const names = engine.list();
    expect(names).toEqual(expect.arrayContaining(['generic', 'ticket-assigned', 'password-reset']));
  });

  it('extracts the subject from the first line and renders variables', () => {
    const out = engine.render('ticket-assigned', {
      assigneeName: 'Sam', ticketNumber: 'TCK-100', ticketTitle: 'Leak', priority: 'high',
    });
    expect(out.subject).toBe('Ticket TCK-100 assigned to you');
    expect(out.html).toContain('Sam');
    expect(out.html).toContain('TCK-100');
    // `upper` helper
    expect(out.html).toContain('HIGH');
  });

  it('wraps the body in the branded layout (header + footer partials)', () => {
    const out = engine.render('generic', { subject: 'Hi', bodyHtml: '<p>Body</p>' });
    expect(out.html).toContain('<!DOCTYPE html>');
    expect(out.html).toContain('Living'); // header brand
    expect(out.html).toContain(String(new Date().getFullYear())); // footer {{year}}
    expect(out.html).toContain('<p>Body</p>');
  });

  it('resolves localization via the {{t}} helper with fallback', () => {
    const out = engine.render('generic', { subject: 'Hi', bodyHtml: '<p>x</p>' }, 'en');
    expect(out.html).toContain('A calm operating system'); // footer_tagline (en)
    // Unknown locale falls back to en, unknown key falls back to the key itself.
    const missing = engine.render('generic', { subject: 'Hi', bodyHtml: '<p>x</p>' }, 'zz');
    expect(missing.html).toContain('A calm operating system');
  });

  it('produces a plain-text fallback stripped of markup', () => {
    const out = engine.render('generic', { subject: 'Hi', heading: 'Welcome', bodyHtml: '<p>Hello there</p>' });
    expect(out.text).toContain('Welcome');
    expect(out.text).toContain('Hello there');
    expect(out.text).not.toContain('<p>');
  });

  it('throws for an unknown template', () => {
    expect(() => engine.render('does-not-exist')).toThrow(/not found/);
  });
});
