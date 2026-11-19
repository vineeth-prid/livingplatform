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
    opts: { subject?: string; locale?: string; layout?: boolean } = {},
  ): RenderedTemplate {
    // Community-authored: validate before compiling, and compile so that only
    // our own helpers are callable (no helperMissing fallback).
    assertSafeTemplate(body);
    if (opts.subject) assertSafeTemplate(opts.subject);
    const options = { knownHelpers: { t: true, year: true, upper: true }, knownHelpersOnly: true };
    const ctx = { ...variables, __locale: opts.locale ?? 'en' };
    const inner = this.hbs.compile(body, options)(ctx);
    const subject = opts.subject ? this.hbs.compile(opts.subject, options)(ctx).trim() : '';
    const html = opts.layout === false
      ? inner
      : this.layout({ ...ctx, body: new Handlebars.SafeString(inner) });
    return { subject, html, text: htmlToText(inner) };
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

/** Minimal HTML → plain-text fallback for the text/plain MIME part. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
