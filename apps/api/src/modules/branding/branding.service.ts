import { createHash } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';

import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export type BrandApp = 'resident' | 'workforce';
export const ICON_SIZES = { '180': 180, '192': 192, '512': 512, 'maskable-512': 512 } as const;
export type IconName = keyof typeof ICON_SIZES;

const APP_NAMES: Record<BrandApp, string> = { resident: 'Residents', workforce: 'Workforce' };

/**
 * A community's public white-label identity: name, logo, theme and the PWA
 * manifest + icons built from them. Public on purpose — the install link and
 * the pre-login screen have no session — so it exposes only what the
 * community already shows on its own app: name, logo and colours.
 *
 * Looked up by community id (a cuid), never by code: codes are only unique
 * within a tenant, and a cuid cannot be enumerated.
 */
@Injectable()
export class BrandingService {
  // ponytail: in-process icon cache, ~4 PNGs per logo; move to storage if many API instances.
  private readonly icons = new Map<string, Buffer>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async get(communityId: string) {
    const c = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
      select: { id: true, name: true, logoKey: true, settings: { select: { theme: true } } },
    });
    if (!c) throw new NotFoundException('Community not found');
    const theme = (c.settings?.theme ?? null) as Record<string, unknown> | null;
    return {
      communityId: c.id,
      name: c.name,
      logoKey: c.logoKey,
      logoUrl: await this.storage.signedUrl(c.logoKey),
      theme,
      // Changes whenever the logo or theme does — the cache-buster for icons,
      // the manifest and every client's stored theme.
      version: createHash('sha1').update(`${c.logoKey ?? ''}|${JSON.stringify(theme)}`).digest('hex').slice(0, 10),
    };
  }

  /** Public view (no storage key). */
  async publicView(communityId: string) {
    const { logoKey: _k, ...view } = await this.get(communityId);
    return view;
  }

  async manifest(communityId: string, app: BrandApp) {
    const b = await this.get(communityId);
    const primary = typeof b.theme?.primary === 'string' ? b.theme.primary : '#234b39';
    const icon = (name: IconName, purpose: 'any' | 'maskable') => ({
      src: `/brand/${b.communityId}/icon-${name}.png?v=${b.version}`,
      sizes: `${ICON_SIZES[name]}x${ICON_SIZES[name]}`,
      type: 'image/png',
      purpose,
    });
    return {
      // The SAME identity as the stock Living manifest ('/'): the app's own
      // /manifest.webmanifest serves this (nginx, by the living_c cookie), so a
      // phone that installed Living earlier sees the same app with a new icon
      // and name — browsers only update an installed app whose id is unchanged.
      id: '/',
      // The install prompt and home screen show the community's own name.
      name: app === 'resident' ? b.name : `${b.name} ${APP_NAMES[app]}`,
      short_name: b.name.slice(0, 12),
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: primary,
      icons: b.logoKey
        ? [icon('192', 'any'), icon('512', 'any'), icon('maskable-512', 'maskable')]
        : [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
    };
  }

  /**
   * A square PNG app icon from the community logo: the logo centred on white
   * with padding, aspect ratio kept (`contain`). Maskable icons get the wider
   * safe-zone padding Android crops to. Null when the community has no logo
   * (the caller falls back to the Living icon).
   */
  async icon(communityId: string, name: IconName): Promise<Buffer | null> {
    const b = await this.get(communityId);
    if (!b.logoKey || !b.logoUrl) return null;
    const cacheKey = `${b.logoKey}|${name}`;
    const hit = this.icons.get(cacheKey);
    if (hit) return hit;

    const res = await fetch(b.logoUrl);
    if (!res.ok) return null;
    const size = ICON_SIZES[name];
    const inner = Math.round(size * (name === 'maskable-512' ? 0.62 : 0.8));
    const logo = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    const png = await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } })
      .composite([{ input: logo, gravity: 'centre' }])
      .png()
      .toBuffer();
    this.icons.set(cacheKey, png);
    return png;
  }
}
