import { EmailTemplateEngine, textToEmailHtml } from './template.engine';

describe('EmailTemplateEngine', () => {
  const engine = new EmailTemplateEngine();

  it('discovers the on-disk templates', () => {
    const names = engine.list();
    expect(names).toEqual(expect.arrayContaining(['generic', 'otp-requested', 'gate-entry-arrived']));
  });

  it('extracts the subject from the first line and renders variables', () => {
    const out = engine.render('generic', { subject: 'Ticket TCK-100 assigned', heading: 'Hi Sam' });
    expect(out.subject).toBe('Ticket TCK-100 assigned');
    expect(out.html).toContain('Hi Sam');
    // `upper` helper, via a runtime template
    expect(engine.renderRaw('{{upper p}}', { p: 'high' }).html).toContain('HIGH');
  });

  it('lays plain notification text out as an email — no HTML needed from anyone', () => {
    const html = textToEmailHtml([
      '*Ticket Update – TKT-1*',
      'Hello <Sam>,',
      'Ticket: TKT-1\nIssue: Tap & "sink"\nPass: *AB12*',
      'Note from our team: call first',
      'View Ticket: https://resident.example.com/t/1?c=2&x=3',
      'Regards,\n*ABC Management Team*',
    ].join('\n\n'));
    expect(html).toContain('<h1>Ticket Update – TKT-1</h1>');
    expect(html).toContain('<p>Hello &lt;Sam&gt;,</p>');
    expect(html).toContain('<td class="k">Issue</td><td>Tap &amp; &quot;sink&quot;</td>');
    expect(html).toContain('<td><strong>AB12</strong></td>');
    expect(html).toContain('<p>Note from our team: call first</p>'); // one line with a colon is prose, not a table
    expect(html).toContain('<a class="btn" href="https://resident.example.com/t/1?c&#x3D;2&amp;x&#x3D;3">View Ticket</a>');
    expect(html).toContain('<p>Regards,<br /><strong>ABC Management Team</strong></p>');
    expect(html).not.toMatch(/<script|<Sam>/);
  });

  it('wraps laid-out text in the branded layout', () => {
    const out = engine.emailFromText('Subj', 'Hello', { brand_name: 'ABC Residency', branded: true });
    expect(out.html).toContain('<!DOCTYPE html>');
    expect(out.html).toContain('ABC Residency');
    expect(out.html).not.toContain('A calm operating system');
    expect(out.text).toBe('Hello');
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
