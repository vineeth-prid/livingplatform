import { Injectable } from '@nestjs/common';

import type { NotificationChannelName } from './notification-channel.interface';
import { NotificationBrandingResolver, type NotificationBrand } from './notification-branding';
import { TEMPLATE_SPECS } from './notification-catalog';
import { EmailTemplateEngine, type RenderedTemplate } from './templates/template.engine';

/** A message that cannot be sent as written — recorded, never dispatched. */
export class MissingVariablesError extends Error {
  constructor(readonly template: string, readonly missing: string[]) {
    super(`Notification "${template}" is missing ${missing.join(', ')}`);
  }
}

export interface RenderInput {
  template: string;
  channel: NotificationChannelName;
  variables: Record<string, unknown>;
  communityId?: string | null;
  /** A community's own wording for this event/channel. */
  override?: { subject: string | null; body: string } | null;
  locale?: string;
}

export interface RenderOutput extends RenderedTemplate {
  brand: NotificationBrand;
}

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/**
 * The single rendering path for routed notifications — live sends AND the
 * template editor's preview call this, so what an admin previews is exactly
 * what a resident receives.
 *
 * Order: resolve branding → merge → refuse if a required value is blank →
 * community wording, else the catalog's default text; email lays that text out
 * in the branded layout. Unknown placeholders are refused when a
 * community saves its wording, so every placeholder rendered here is supplied.
 */
@Injectable()
export class NotificationRenderer {
  constructor(
    private readonly engine: EmailTemplateEngine,
    private readonly branding: NotificationBrandingResolver,
  ) {}

  async render(input: RenderInput): Promise<RenderOutput> {
    const brand = await this.branding.for(input.communityId);
    // Branding is authoritative: an event can't sign a message as someone else.
    const vars: Record<string, unknown> = { ...input.variables, ...brand };
    for (const [k, v] of Object.entries(vars)) if (blank(v)) vars[k] = '';

    const spec = TEMPLATE_SPECS[input.template];
    const missing = (spec?.required ?? []).filter((k) => blank(vars[k]));
    if (missing.length) throw new MissingVariablesError(input.template, missing);

    // Both channels start from the same plain text — the community's own
    // wording if it has some, else the catalog default. Email then lays it out.
    let subject: string;
    let body: string;
    if (input.override) {
      const raw = this.engine.renderRaw(input.override.body, vars, {
        subject: input.override.subject ?? undefined,
        locale: input.locale,
        text: true,
      });
      subject = raw.subject || (spec ? this.engine.renderText(spec.subject, vars) : '');
      body = raw.text;
    } else if (spec) {
      subject = this.engine.renderText(spec.subject, vars, input.locale);
      body = this.engine.renderText(spec.text, vars, input.locale);
    } else {
      return { ...this.engine.render(input.template, vars, input.locale), brand };
    }

    const out: RenderedTemplate = input.channel === 'email'
      ? this.engine.emailFromText(subject || brand.brand_name, body, vars, input.locale)
      : { subject, html: body, text: body };
    return { ...out, subject: out.subject || brand.brand_name, brand };
  }
}
