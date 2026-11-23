import { NotificationEvent } from '@prisma/client';

import { allowedVariables, EVENT_TEMPLATE, sampleVariables, TEMPLATE_SPECS, ticketUpdateDescription, VARIABLES } from './notification-catalog';
import { assertSafeTemplate, EmailTemplateEngine, templateVariables } from './templates/template.engine';

const engine = new EmailTemplateEngine();

/**
 * The registry is only worth anything if the templates obey it: a placeholder
 * no event supplies is exactly how "Hello ," reached residents.
 */
describe('notification catalog', () => {
  it('gives every configurable event a template with a subject and wording', () => {
    for (const event of Object.values(NotificationEvent)) {
      if (event === 'GATE_ENTRY_ARRIVED' || event === 'GATE_ENTRY_DECIDED') continue; // gate has its own settings
      const spec = TEMPLATE_SPECS[EVENT_TEMPLATE[event]!];
      expect(spec).toBeDefined();
      expect(spec!.subject.length).toBeGreaterThan(3);
      expect(spec!.text.length).toBeGreaterThan(20);
    }
  });

  it.each(Object.keys(TEMPLATE_SPECS))('%s only uses declared variables', (template) => {
    const allowed = new Set<string>(allowedVariables(template));
    const spec = TEMPLATE_SPECS[template]!;
    for (const src of [spec.text, spec.subject]) {
      // Defaults must also be saveable as a community's own wording ("Reset to default").
      expect(() => assertSafeTemplate(src)).not.toThrow();
      expect(templateVariables(src).filter((v) => !allowed.has(v))).toEqual([]);
    }
    for (const v of spec.required) expect(spec.variables).toContain(v);
    for (const v of allowedVariables(template)) expect(VARIABLES[v]).toBeDefined();
  });

  it.each(Object.keys(TEMPLATE_SPECS))('%s renders on both channels with no gaps', (template) => {
    const vars = sampleVariables(template);
    const spec = TEMPLATE_SPECS[template]!;
    const text = engine.renderText(spec.text, vars);
    expect(text).not.toMatch(/\{\{|undefined|null|\n{3,}| ,/);
    const subject = engine.renderText(spec.subject, vars);
    expect(subject).not.toMatch(/—\s*$|undefined|\{\{/);
    const mail = engine.emailFromText(subject, text, vars);
    expect(mail.html).toContain('<h1>');
    expect(mail.html).not.toMatch(/\{\{|\*[^*<\n]+\*/); // every *bold* became <strong>
  });

  it('describes a status only with what the transition says', () => {
    expect(ticketUpdateDescription('OPEN', 'RESOLVED')).toContain('marked as resolved');
    expect(ticketUpdateDescription('OPEN', 'MYSTERY')).toBe('');
    expect(ticketUpdateDescription('OPEN', 'MYSTERY', 'Call me')).toBe('Note from our team: Call me');
  });
});
