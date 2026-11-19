import { assertSafeTemplate, EmailTemplateEngine, UnsafeTemplateError } from './template.engine';

describe('assertSafeTemplate (community-authored templates)', () => {
  it.each([
    'Hello {{residentName}}, you owe {{amount}}.',
    '{{t "greeting"}} {{upper unitNumber}}',
    '{{#if dueDate}}Due {{dueDate}}{{else}}No due date{{/if}}',
    '{{#each items}}- {{this.name}}{{/each}}',
    '{{! a comment }}plain text',
  ])('accepts %s', (src) => {
    expect(() => assertSafeTemplate(src)).not.toThrow();
  });

  it.each([
    ['partial', '{{> header}}'],
    ['unknown helper', '{{lookup this "x"}}'],
    ['sub-expression', '{{upper (lookup this "x")}}'],
    ['prototype path', '{{constructor.constructor}}'],
    ['__proto__ path', '{{#with __proto__}}x{{/with}}'],
    ['custom block', '{{#blockHelperMissing x}}y{{/blockHelperMissing}}'],
    ['decorator', '{{* inline}}'],
  ])('rejects %s', (_label, src) => {
    expect(() => assertSafeTemplate(src)).toThrow(UnsafeTemplateError);
  });

  it('renderRaw renders a safe override and refuses an unsafe one', () => {
    const engine = new EmailTemplateEngine();
    const out = engine.renderRaw('Hi {{name}}', { name: 'Asha' }, { layout: false });
    expect(out.html).toBe('Hi Asha');
    expect(() => engine.renderRaw('{{constructor.name}}', {}, { layout: false })).toThrow(UnsafeTemplateError);
  });
});
