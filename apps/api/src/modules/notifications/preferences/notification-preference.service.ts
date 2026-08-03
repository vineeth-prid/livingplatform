import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationEvent } from '@prisma/client';

import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunityAccessService } from '../../tenancy/community-access.service';
import type {
  UpdateNotificationPreferenceDto,
  UpsertNotificationTemplateDto,
} from './dto/notification-preference.dto';

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
  channels: Array<'email' | 'whatsapp'>;
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
        whatsappEnabled: row?.whatsappEnabled ?? settings?.whatsappEnabled ?? false,
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
        select: { emailEnabled: true, whatsappEnabled: true },
      }),
    ]);

    if (row && !row.enabled) return { enabled: false, channels: [] };
    const email = row?.emailEnabled ?? settings?.emailEnabled ?? true;
    const whatsapp = row?.whatsappEnabled ?? settings?.whatsappEnabled ?? false;
    const channels: Array<'email' | 'whatsapp'> = [];
    if (email) channels.push('email');
    if (whatsapp) channels.push('whatsapp');
    return { enabled: channels.length > 0, channels };
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
