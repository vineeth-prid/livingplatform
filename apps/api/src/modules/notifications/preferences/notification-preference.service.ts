import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationEvent } from '@prisma/client';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunityAccessService } from '../../tenancy/community-access.service';
import type { NotificationChannelName } from '../core/notification-channel.interface';
import { allowedVariables, EVENT_TEMPLATE, sampleVariables, TEMPLATE_SPECS, VARIABLES } from '../core/notification-catalog';
import { MissingVariablesError, NotificationRenderer } from '../core/notification-renderer';
import { assertSafeTemplate, templateVariables, UnsafeTemplateError } from '../core/templates/template.engine';
import type {
  PreviewNotificationTemplateDto,
  UpdateNotificationPreferenceDto,
  UpsertNotificationTemplateDto,
} from './dto/notification-preference.dto';

/**
 * Events whose channel set is decided by the Gate Management settings rather
 * than the generic email/WhatsApp preference. Gate notifications are
 * time-critical and interactive, so in-app + push lead and email/WhatsApp are
 * opt-in — the inverse of every other event, which is why they are special-cased
 * here instead of bending the generic defaults.
 */
/**
 * Payment receipts go out on WhatsApp unless a community switches it off —
 * people expect proof of payment where they read messages.
 */
const WHATSAPP_BY_DEFAULT = new Set<NotificationEvent>([
  NotificationEvent.PAYMENT_SUCCESS,
  NotificationEvent.PAYMENT_CONFIRMATION,
]);

const GATE_EVENTS = new Set<NotificationEvent>([
  NotificationEvent.GATE_ENTRY_ARRIVED,
  NotificationEvent.GATE_ENTRY_DECIDED,
]);

export interface PreferenceView {
  event: NotificationEvent;
  enabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  /** False when no row exists yet — the community is on platform defaults. */
  configured: boolean;
}

/** Whether an event may be delivered on a channel for a community. */
export interface ResolvedRouting {
  enabled: boolean;
  channels: NotificationChannelName[];
}

/**
 * Per-community notification routing and message templates.
 *
 * Absent preference row = platform default: email on, WhatsApp following the
 * community's existing `CommunitySettings.whatsappEnabled` toggle. That keeps
 * every community working exactly as before this sprint until an admin opts in,
 * and it means adding a new event needs no data migration.
 */
@Injectable()
export class NotificationPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly renderer: NotificationRenderer,
  ) {}

  // ── Preferences ────────────────────────────────────────────────────────────

  /** Every event, with its effective setting (configured or defaulted). */
  async list(communityId: string): Promise<PreferenceView[]> {
    await this.access.assert(communityId);
    const [rows, settings] = await Promise.all([
      this.prisma.communityNotificationPreference.findMany({ where: { communityId } }),
      this.prisma.communitySettings.findUnique({
        where: { communityId },
        select: { emailEnabled: true, whatsappEnabled: true },
      }),
    ]);
    const byEvent = new Map(rows.map((r) => [r.event, r]));
    return Object.values(NotificationEvent).map((event) => {
      const row = byEvent.get(event);
      return {
        event,
        enabled: row?.enabled ?? true,
        emailEnabled: row?.emailEnabled ?? settings?.emailEnabled ?? true,
        whatsappEnabled: row?.whatsappEnabled ?? (WHATSAPP_BY_DEFAULT.has(event) || (settings?.whatsappEnabled ?? false)),
        configured: Boolean(row),
      };
    });
  }

  async update(
    communityId: string,
    event: NotificationEvent,
    dto: UpdateNotificationPreferenceDto,
    actor: AuthenticatedUser,
  ): Promise<PreferenceView> {
    await this.access.assert(communityId);
    const data = {
      enabled: dto.enabled,
      emailEnabled: dto.emailEnabled,
      whatsappEnabled: dto.whatsappEnabled,
      updatedById: actor.id,
    };
    const row = await this.prisma.communityNotificationPreference.upsert({
      where: { communityId_event: { communityId, event } },
      create: { communityId, event, ...data },
      update: data,
    });
    return {
      event: row.event,
      enabled: row.enabled,
      emailEnabled: row.emailEnabled,
      whatsappEnabled: row.whatsappEnabled,
      configured: true,
    };
  }

  /** Only the event's on/off switch — for events whose channels are fixed (announcements). */
  async isEnabled(communityId: string, event: NotificationEvent): Promise<boolean> {
    const row = await this.prisma.communityNotificationPreference.findUnique({
      where: { communityId_event: { communityId, event } },
      select: { enabled: true },
    });
    return row?.enabled ?? true;
  }

  /**
   * The routing decision for one event — the ONE question the notification
   * router asks. Returns the channels to fan out to, already filtered.
   */
  async resolve(communityId: string | null, event: NotificationEvent): Promise<ResolvedRouting> {
    if (!communityId) return { enabled: true, channels: ['email'] };

    const [row, settings] = await Promise.all([
      this.prisma.communityNotificationPreference.findUnique({
        where: { communityId_event: { communityId, event } },
      }),
      this.prisma.communitySettings.findUnique({
        where: { communityId },
        select: {
          emailEnabled: true,
          whatsappEnabled: true,
          gateManagementEnabled: true,
          gatePushEnabled: true,
          gateWhatsappEnabled: true,
          gateEmailEnabled: true,
        },
      }),
    ]);

    if (row && !row.enabled) return { enabled: false, channels: [] };

    if (GATE_EVENTS.has(event)) {
      return this.resolveGate(row, settings);
    }

    const email = row?.emailEnabled ?? settings?.emailEnabled ?? true;
    const whatsapp = row?.whatsappEnabled ?? (WHATSAPP_BY_DEFAULT.has(event) || (settings?.whatsappEnabled ?? false));
    const channels: NotificationChannelName[] = [];
    if (email) channels.push('email');
    if (whatsapp) channels.push('whatsapp');
    return { enabled: channels.length > 0, channels };
  }

  /**
   * Channel set for a gate event. In-app is ALWAYS on — it is the popup the
   * whole feature exists for, and it costs nothing to attempt. The rest follow
   * the community's gate settings, with the generic per-event overrides still
   * able to switch email/WhatsApp off.
   */
  private resolveGate(
    row: { emailEnabled: boolean; whatsappEnabled: boolean } | null,
    settings: {
      gateManagementEnabled: boolean;
      gatePushEnabled: boolean;
      gateWhatsappEnabled: boolean;
      gateEmailEnabled: boolean;
    } | null,
  ): ResolvedRouting {
    // No settings row yet = a community that predates this sprint. Schema
    // defaults apply, which is module ON.
    if (settings && !settings.gateManagementEnabled) return { enabled: false, channels: [] };

    const channels: NotificationChannelName[] = ['inapp'];
    if (settings?.gatePushEnabled ?? true) channels.push('push');
    if ((settings?.gateWhatsappEnabled ?? false) && (row?.whatsappEnabled ?? true)) {
      channels.push('whatsapp');
    }
    if ((settings?.gateEmailEnabled ?? false) && (row?.emailEnabled ?? true)) {
      channels.push('email');
    }
    return { enabled: true, channels };
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  async listTemplates(communityId: string) {
    await this.access.assert(communityId);
    return this.prisma.communityNotificationTemplate.findMany({
      where: { communityId },
      orderBy: [{ event: 'asc' }, { channel: 'asc' }],
    });
  }

  async upsertTemplate(
    communityId: string,
    dto: UpsertNotificationTemplateDto,
    actor: AuthenticatedUser,
  ) {
    await this.access.assert(communityId);
    // Refuse anything beyond variables / {{t}} / simple blocks at save time, so
    // the admin sees why instead of the message silently falling back later.
    this.assertTemplate(dto.event, dto.body, dto.subject);
    const key = {
      communityId,
      event: dto.event,
      channel: dto.channel,
      locale: dto.locale ?? 'en',
    };
    return this.prisma.communityNotificationTemplate.upsert({
      where: { communityId_event_channel_locale: key },
      create: { ...key, subject: dto.subject, body: dto.body, enabled: dto.enabled ?? true, createdById: actor.id },
      update: { subject: dto.subject, body: dto.body, enabled: dto.enabled, updatedById: actor.id },
    });
  }

  /**
   * Refuse wording that is unsafe or names a placeholder this event never
   * supplies — saved, it would reach residents as a gap ("Hello ,").
   */
  private assertTemplate(event: NotificationEvent, body: string, subject?: string | null): void {
    try {
      assertSafeTemplate(body);
      if (subject) assertSafeTemplate(subject);
    } catch (err) {
      if (err instanceof UnsafeTemplateError) throw new BadRequestException(err.message);
      throw err;
    }
    const allowed = new Set<string>(allowedVariables(EVENT_TEMPLATE[event]));
    const unknown = [...templateVariables(body), ...(subject ? templateVariables(subject) : [])]
      .filter((v) => !allowed.has(v));
    if (unknown.length) {
      throw new BadRequestException(
        `Unknown variable${unknown.length > 1 ? 's' : ''}: ${[...new Set(unknown)].map((v) => `{{${v}}}`).join(', ')}`,
      );
    }
  }

  /**
   * What the editor needs per event: the variables it may use (with which are
   * required) and the platform's default wording for each channel — the text
   * "Reset to default" restores.
   */
  async templateDefaults(communityId: string) {
    await this.access.assert(communityId);
    return Object.values(NotificationEvent)
      .filter((event) => EVENT_TEMPLATE[event])
      .map((event) => {
        const template = EVENT_TEMPLATE[event];
        const spec = TEMPLATE_SPECS[template];
        const required = new Set<string>(spec?.required ?? []);
        return {
          event,
          variables: allowedVariables(template).map((name) => ({
            name,
            label: VARIABLES[name].label,
            required: required.has(name),
          })),
          // Same plain text on both channels; email adds a subject and lays it out.
          email: { subject: spec?.subject ?? '', body: spec?.text ?? '' },
          whatsapp: { subject: '', body: spec?.text ?? '' },
        };
      });
  }

  /**
   * Render wording with sample values and THIS community's real branding,
   * through the same renderer live sends use. Errors come back as a message
   * for the editor, not an exception, so the preview can show them inline.
   */
  async preview(communityId: string, dto: PreviewNotificationTemplateDto) {
    await this.access.assert(communityId);
    const template = EVENT_TEMPLATE[dto.event];
    const body = dto.body?.trim();
    try {
      if (body) this.assertTemplate(dto.event, body, dto.subject);
      // Branding samples are replaced by the community's real identity in render().
      const out = await this.renderer.render({
        template,
        channel: dto.channel,
        variables: sampleVariables(template),
        communityId,
        override: body ? { subject: dto.subject ?? null, body } : null,
      });
      return { ok: true, subject: out.subject, text: out.text, html: dto.channel === 'email' ? out.html : null, error: null };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof MissingVariablesError || err instanceof UnsafeTemplateError) {
        return { ok: false, subject: '', text: '', html: null, error: (err as Error).message };
      }
      // A Handlebars parse error ("Parse error on line 2…") is the admin's typo.
      return { ok: false, subject: '', text: '', html: null, error: (err as Error).message.split('\n')[0] };
    }
  }

  async removeTemplate(communityId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    await this.access.assert(communityId);
    const row = await this.prisma.communityNotificationTemplate.findFirst({
      where: { id, communityId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Template not found');
    await this.prisma.communityNotificationTemplate.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * The community's override for an event+channel, or null to fall back to the
   * platform's built-in .hbs template.
   */
  async templateFor(
    communityId: string | null,
    event: NotificationEvent,
    channel: string,
    locale = 'en',
  ): Promise<{ subject: string | null; body: string } | null> {
    if (!communityId) return null;
    const row = await this.prisma.communityNotificationTemplate.findUnique({
      where: { communityId_event_channel_locale: { communityId, event, channel, locale } },
    });
    if (!row || !row.enabled) return null;
    return { subject: row.subject, body: row.body };
  }
}
