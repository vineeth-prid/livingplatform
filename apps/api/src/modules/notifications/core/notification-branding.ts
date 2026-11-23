import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/configuration';
import { BrandingService } from '../../branding/branding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { appLinks } from './notification-catalog';

/** The identity a notification speaks with. Every value is a template variable. */
export interface NotificationBrand {
  /** The community's own name — content ("Welcome to …") uses it either way. */
  community_name: string;
  /** Header/footer name: the community when it has its own branding, else Living. */
  brand_name: string;
  signature: string;
  /** Square logo for the email header; empty for Living's text wordmark. */
  logo_url: string;
  brand_color: string;
  support_email: string;
  support_phone: string;
  /** True when the community has its own logo or theme. */
  branded: boolean;
  /** Email From display name (the sending address itself never changes). */
  sender_name: string;
  timezone: string;
}

const LIVING_GREEN = '#234b39';

export const LIVING_BRAND: NotificationBrand = {
  community_name: 'your community',
  brand_name: 'Living',
  signature: 'Living Community Management Team',
  logo_url: '',
  brand_color: LIVING_GREEN,
  support_email: '',
  support_phone: '',
  branded: false,
  sender_name: 'Living',
  timezone: 'Asia/Kolkata',
};

/**
 * The ONE branding lookup for notifications — every event, every channel and
 * the editor preview resolve identity here, from the community the EVENT
 * belongs to (never a browser's current selection), so community A can never be
 * signed as community B.
 *
 * A community with its own logo or theme speaks as itself: its name in the
 * signature, header and email display name, its logo and colour in the email.
 * One without keeps the Living identity.
 */
@Injectable()
export class NotificationBrandingResolver {
  private readonly logger = new Logger(NotificationBrandingResolver.name);
  private readonly residentUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly branding: BrandingService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.residentUrl = appLinks(config.get('webAppUrl', { infer: true })).resident;
  }

  async for(communityId: string | null | undefined): Promise<NotificationBrand> {
    if (!communityId) return LIVING_BRAND;
    try {
      const c = await this.prisma.community.findFirst({
        where: { id: communityId, deletedAt: null },
        select: { name: true, logoKey: true, contactEmail: true, contactPhone: true, timezone: true },
      });
      if (!c) return LIVING_BRAND;
      const view = await this.branding.get(communityId);
      const theme = view.theme as { primary?: string } | null;
      const branded = Boolean(c.logoKey || theme);
      const contacts = {
        community_name: c.name,
        support_email: c.contactEmail ?? '',
        support_phone: c.contactPhone ?? '',
        timezone: c.timezone || LIVING_BRAND.timezone,
      };
      if (!branded) return { ...LIVING_BRAND, ...contacts };
      return {
        ...contacts,
        brand_name: c.name,
        signature: `${c.name} Management Team`,
        // The public, cache-busted icon the community's own PWA uses — a stable
        // URL, unlike a signed storage link that would expire inside the inbox.
        logo_url: c.logoKey ? `${this.residentUrl}/brand/${communityId}/icon-180.png?v=${view.version}` : '',
        brand_color: theme?.primary || LIVING_GREEN,
        branded: true,
        sender_name: c.name,
      };
    } catch (err) {
      this.logger.warn(`Branding lookup failed for ${communityId}: ${(err as Error).message}`);
      return LIVING_BRAND;
    }
  }
}
