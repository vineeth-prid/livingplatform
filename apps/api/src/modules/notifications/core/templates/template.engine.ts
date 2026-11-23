import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Thrown when a community-written template uses anything beyond plain variable
 * substitution and the small helper/block allow-list below.
 */
export class UnsafeTemplateError extends Error {}

/** Built-in block helpers a community template may use. */
const SAFE_BLOCKS = new Set(['if', 'unless', 'each', 'with']);
/** Our own helpers (see registerHelpers) — the only names callable with arguments. */
const SAFE_HELPERS = new Set(['t', 'year', 'upper']);
/** Path segments that reach the prototype chain rather than template data. */
const FORBIDDEN_SEGMENT =
  /^(constructor|prototype|__proto__|__defineGetter__|__defineSetter__|__lookupGetter__|__lookupSetter__)$/;
const LITERALS = new Set(['StringLiteral', 'NumberLiteral', 'BooleanLiteral']);

/**
 * Validate a COMMUNITY-AUTHORED template before it is ever compiled.
 *
 * Tenant admins write these bodies and the API compiles them server-side, so
 * the template language is an attack surface (Handlebars has shipped
 * compile-time code-injection bugs). Tenants need variables, {{t}} and simple
 * conditionals/loops — nothing else — so the AST is walked and anything outside
 * that (partials, decorators, sub-expressions, raw blocks, unknown helpers,
 * prototype paths) is refused. Built-in templates on disk are trusted and skip this.
 */
export function assertSafeTemplate(source: string): void {
  const fail = (why: string): never => {
    throw new UnsafeTemplateError(why);
  };
  let ast: hbs.AST.Program;
  try {
    ast = Handlebars.parse(source);
  } catch (e) {
    return fail(`Template does not parse: ${(e as Error).message}`);
  }
  const checkPath = (p: hbs.AST.PathExpression) => {
    if (p.parts.some((s) => FORBIDDEN_SEGMENT.test(s))) fail(`"${p.original}" is not allowed`);
  };
  const checkParam = (e: hbs.AST.Expression) => {
    if (e.type === 'PathExpression') return checkPath(e as hbs.AST.PathExpression);
    if (!LITERALS.has(e.type)) fail(`${e.type} is not allowed in a community template`);
  };
  const walk = (program: hbs.AST.Program | undefined): void => {
    for (const node of program?.body ?? []) {
      switch (node.type) {
        case 'ContentStatement':
        case 'CommentStatement':
          break;
        case 'MustacheStatement': {
          const m = node as hbs.AST.MustacheStatement;
          if (m.path.type !== 'PathExpression') fail('Only variables and {{t}} are allowed');
          const path = m.path as hbs.AST.PathExpression;
          checkPath(path);
          // {{{raw}}} would put resident-typed text into an email unescaped.
          if (!m.escaped) fail(`"{{{${path.original}}}}" is not allowed — use {{${path.original}}}`);
          if (m.params.length || m.hash?.pairs.length) {
            if (!SAFE_HELPERS.has(path.original)) fail(`Helper "${path.original}" is not allowed`);
            m.params.forEach(checkParam);
            m.hash?.pairs.forEach((p) => checkParam(p.value));
          }
          break;
        }
        case 'BlockStatement': {
          const b = node as hbs.AST.BlockStatement;
          const name = (b.path as hbs.AST.PathExpression).original;
          if (b.path.type !== 'PathExpression' || !SAFE_BLOCKS.has(name)) fail(`Block "${name}" is not allowed`);
          b.params.forEach(checkParam);
          walk(b.program);
          walk(b.inverse);
          break;
        }
        default:
          fail(`${node.type} is not allowed in a community template`);
      }
    }
  };
  walk(ast);
}

/**
 * Variable names a template reads (helpers and block keywords excluded), so the
 * editor can refuse a placeholder no event supplies. Call after assertSafeTemplate.
 */
export function templateVariables(source: string): string[] {
  const found = new Set<string>();
  const add = (e: hbs.AST.Expression) => {
    if (e.type !== 'PathExpression') return;
    const p = e as hbs.AST.PathExpression;
    if (p.original !== 'this' && !p.original.startsWith('@')) found.add(p.parts[0] ?? p.original);
  };
  const walk = (program: hbs.AST.Program | undefined): void => {
    for (const node of program?.body ?? []) {
      if (node.type === 'MustacheStatement') {
        const m = node as hbs.AST.MustacheStatement;
        const name = (m.path as hbs.AST.PathExpression).original;
        if (SAFE_HELPERS.has(name) && (m.params.length || name === 'year')) m.params.forEach(add);
        else add(m.path as hbs.AST.Expression);
      } else if (node.type === 'BlockStatement') {
        const b = node as hbs.AST.BlockStatement;
        b.params.forEach(add);
        walk(b.program);
        walk(b.inverse);
      }
    }
  };
  walk(Handlebars.parse(source));
  return [...found];
}

interface Compiled {
  subject: Handlebars.TemplateDelegate;
  body: Handlebars.TemplateDelegate;
}

/**
 * Reusable email template engine (Handlebars). Separates branding (layout +
 * header/footer partials) from content (per-email body templates) and supports
 * variables, partials, layouts and localization — NO HTML lives in services.
 *
 * Layout:  templates/layouts/base.hbs   — wraps every email ({{{body}}}).
 * Partials: templates/partials/*.hbs    — header/footer, auto-registered.
 * Emails:  templates/emails/<name>.hbs  — the body; first line `Subject: …`
 *          becomes the subject (rendered with the same variables).
 * Locales: templates/locales/<loc>.json — `{{t "key"}}` string lookups.
 */
@Injectable()
export class EmailTemplateEngine {
  private readonly logger = new Logger(EmailTemplateEngine.name);
  private readonly hbs: typeof Handlebars;
  private readonly root = __dirname;
  private readonly cache = new Map<string, Compiled>();
  private readonly textCache = new Map<string, Handlebars.TemplateDelegate>();
  private layout!: Handlebars.TemplateDelegate;
  private locales = new Map<string, Record<string, string>>();

  constructor() {
    this.hbs = Handlebars.create();
    this.registerHelpers();
    this.registerPartials();
    this.loadLayout();
    this.loadLocales();
  }

  /** All body template names discovered on disk (for admin/tests). */
  list(): string[] {
    const dir = join(this.root, 'emails');
    return existsSync(dir)
      ? readdirSync(dir).filter((f) => f.endsWith('.hbs')).map((f) => basename(f, '.hbs'))
      : [];
  }

  render(name: string, variables: Record<string, unknown> = {}, locale = 'en'): RenderedTemplate {
    const compiled = this.compile(name);
    const ctx = { ...variables, __locale: locale };
    const subject = compiled.subject(ctx).trim();
    const inner = compiled.body(ctx);
    const html = this.layout({ ...ctx, body: new Handlebars.SafeString(inner) });
    return { subject, html, text: htmlToText(inner) };
  }

  /**
   * Render a template supplied at runtime rather than from disk — this is how a
   * community's own message body (CommunityNotificationTemplate) is rendered.
   * Same helpers, partials, layout and locale table as a built-in template, so
   * an override behaves identically to the default it replaces.
   */
  renderRaw(
    body: string,
    variables: Record<string, unknown> = {},
    opts: { subject?: string; locale?: string; layout?: boolean; text?: boolean } = {},
  ): RenderedTemplate {
    // Community-authored: validate before compiling, and compile so that only
    // our own helpers are callable (no helperMissing fallback).
    assertSafeTemplate(body);
    if (opts.subject) assertSafeTemplate(opts.subject);
    // Text channels get the body verbatim: no HTML escaping, no layout.
    const options = {
      knownHelpers: { t: true, year: true, upper: true },
      knownHelpersOnly: true,
      noEscape: !!opts.text,
      ignoreStandalone: !!opts.text,
    };
    const ctx = { ...variables, __locale: opts.locale ?? 'en' };
    const inner = this.hbs.compile(body, options)(ctx);
    if (opts.text) {
      const subject = opts.subject ? this.hbs.compile(opts.subject, options)(ctx).trim() : '';
      const text = tidyText(inner);
      return { subject, html: text, text };
    }
    const subject = opts.subject ? this.hbs.compile(opts.subject, options)(ctx).trim() : '';
    const html = opts.layout === false
      ? inner
      : this.layout({ ...ctx, body: new Handlebars.SafeString(inner) });
    return { subject, html, text: htmlToText(inner) };
  }

  /**
   * Render a TRUSTED built-in plain-text template (WhatsApp wording). No HTML
   * escaping — the channel is plain text, and escaping is what turned quotes
   * into "&#x27;" in WhatsApp.
   */
  renderText(source: string, variables: Record<string, unknown> = {}, locale = 'en'): string {
    let compiled = this.textCache.get(source);
    if (!compiled) {
      // ignoreStandalone: a block tag on its own line keeps its line break, so
      // the blank lines written in the wording are the blank lines sent.
      compiled = this.hbs.compile(source, { noEscape: true, ignoreStandalone: true });
      this.textCache.set(source, compiled);
    }
    return tidyText(compiled({ ...variables, __locale: locale }));
  }

  /**
   * An email from already-rendered plain text: laid out by textToEmailHtml and
   * wrapped in the branded layout. `variables` feed the layout (brand, colours).
   */
  emailFromText(subject: string, text: string, variables: Record<string, unknown> = {}, locale = 'en'): RenderedTemplate {
    const inner = textToEmailHtml(text);
    const html = this.layout({ ...variables, subject, __locale: locale, body: new Handlebars.SafeString(inner) });
    return { subject, html, text };
  }

  private compile(name: string): Compiled {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const file = join(this.root, 'emails', `${name}.hbs`);
    if (!existsSync(file)) throw new Error(`Email template "${name}" not found`);
    const source = readFileSync(file, 'utf-8');
    // Optional first line `Subject: ...` defines the subject template.
    const match = /^Subject:\s*(.+)\r?\n/.exec(source);
    const subjectSrc = match?.[1] ?? '';
    const bodySrc = match ? source.slice(match[0].length) : source;
    const compiled: Compiled = {
      subject: this.hbs.compile(subjectSrc),
      body: this.hbs.compile(bodySrc),
    };
    this.cache.set(name, compiled);
    return compiled;
  }

  private registerHelpers(): void {
    // Localization: {{t "greeting"}} → locale string, falling back to the key.
    this.hbs.registerHelper('t', (key: string, options: Handlebars.HelperOptions) => {
      const locale = (options?.data?.root?.__locale as string) ?? 'en';
      const table = this.locales.get(locale) ?? this.locales.get('en') ?? {};
      return table[key] ?? key;
    });
    this.hbs.registerHelper('year', () => new Date().getFullYear());
    this.hbs.registerHelper('upper', (s: unknown) => String(s ?? '').toUpperCase());
  }

  private registerPartials(): void {
    const dir = join(this.root, 'partials');
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.hbs'))) {
      this.hbs.registerPartial(basename(file, '.hbs'), readFileSync(join(dir, file), 'utf-8'));
    }
  }

  private loadLayout(): void {
    const file = join(this.root, 'layouts', 'base.hbs');
    this.layout = existsSync(file)
      ? this.hbs.compile(readFileSync(file, 'utf-8'))
      : this.hbs.compile('{{{body}}}');
    if (!existsSync(file)) this.logger.warn('base layout missing — emails render without branding wrapper');
  }

  private loadLocales(): void {
    const dir = join(this.root, 'locales');
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      try {
        this.locales.set(basename(file, '.json'), JSON.parse(readFileSync(join(dir, file), 'utf-8')));
      } catch (e) {
        this.logger.warn(`Failed to load locale ${file}: ${(e as Error).message}`);
      }
    }
  }
}

/**
 * Lay plain notification text out as email HTML. Every value is escaped; the
 * only markup comes from the shape of the text:
 *   - a first paragraph that is one *bold* line → the heading
 *   - a paragraph that is one "Label: https://…" line → a button
 *   - a paragraph of 2+ "Label: value" lines → a details table
 *   - anything else → a paragraph (line breaks kept, *bold* honoured)
 */
export function textToEmailHtml(text: string): string {
  const esc = (v: string) => Handlebars.escapeExpression(v);
  const inline = (v: string) => esc(v).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block, i) => {
      const lines = block.split('\n');
      if (i === 0 && lines.length === 1 && /^\*[^*\n]+\*$/.test(lines[0]!)) {
        return `<h1>${esc(lines[0]!.slice(1, -1))}</h1>`;
      }
      const link = lines.length === 1 ? /^([^:\n]{1,60}):\s*(https?:\/\/\S+)$/.exec(lines[0]!) : null;
      if (link) {
        return `<p style="margin: 22px 0;"><a class="btn" href="${esc(link[2]!)}">${esc(link[1]!)}</a></p>`;
      }
      const rows = lines.map((l) => /^([^:\n]{1,40}):\s+(.+)$/.exec(l));
      if (lines.length > 1 && rows.every(Boolean)) {
        const tr = rows.map((r) => `<tr><td class="k">${esc(r![1]!)}</td><td>${inline(r![2]!)}</td></tr>`).join('');
        return `<table class="details" role="presentation">${tr}</table>`;
      }
      return `<p>${lines.map(inline).join('<br />')}</p>`;
    })
    .join('\n');
}

/** Collapse the blank lines left behind by skipped optional sections. */
function tidyText(text: string): string {
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Minimal HTML → plain-text fallback for the text/plain MIME part. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x3D;/g, '=')
    .replace(/&#x60;/g, '`')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
