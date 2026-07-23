import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
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
