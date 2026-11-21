import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { applyCommunityTheme, type CommunityTheme } from '@living/design-system';
import { useLiving } from '@living/hooks';
import { cn } from '@living/utils';

/**
 * Loads a community's public branding and applies it app-wide: the theme
 * tokens, and — for the installable apps — the PWA manifest and home-screen
 * icon, served same-origin from `/brand/<id>/…` (nginx → API). The favicon is
 * deliberately left alone: browser tabs always show the Living "L".
 *
 * `communityId` null leaves whatever is applied (the cached theme), so a
 * signed-out screen on a branded phone stays branded.
 */
export function useCommunityBranding(
  communityId: string | null | undefined,
  options: { app?: 'resident' | 'workforce' } = {},
) {
  const living = useLiving();
  const { data } = useQuery({
    queryKey: ['community', communityId, 'branding'],
    queryFn: () => living.community.branding(communityId!),
    enabled: !!communityId,
    staleTime: 5 * 60_000,
  });
  const app = options.app;

  useEffect(() => {
    if (!data) return;
    applyCommunityTheme(data.theme as CommunityTheme | null);
    if (!app) return;
    const v = encodeURIComponent(data.version);
    // The server serves /manifest.webmanifest for the community in this cookie,
    // at the manifest URL an installed app already knows — that is what lets an
    // existing install pick up the community icon. `?v` makes the browser (and
    // the service worker's precache) fetch it fresh when the branding changes.
    document.cookie = `living_c=${data.communityId}; path=/; max-age=31536000; SameSite=Lax; Secure`;
    setLink('manifest', `/manifest.webmanifest?v=${v}`);
    // Manifest requests omit cookies unless asked — the server needs living_c.
    document.querySelector('link[rel="manifest"]')?.setAttribute('crossorigin', 'use-credentials');
    setLink(
      'apple-touch-icon',
      data.logoUrl ? `/brand/${data.communityId}/icon-180.png?v=${v}` : '/apple-touch-icon.png',
    );
  }, [data, app]);

  return data;
}

const INSTALL_KEY = 'living.install-community';

/**
 * The community from a per-community install link (`/?c=<communityId>`), which
 * is also the installed app's start_url. Remembered, so the sign-in screen and
 * every later launch are branded before anyone has signed in.
 */
export function installCommunityId(): string | null {
  if (typeof window === 'undefined') return null;
  const valid = (v: string | null | undefined): v is string => !!v && /^[a-z0-9]{20,40}$/i.test(v);
  const fromUrl = new URLSearchParams(window.location.search).get('c');
  // The community this device last showed (set whenever branding loads) — so
  // the sign-in screen stays branded after sign-out, not only via the link.
  const fromCookie = /(?:^|;\s*)living_c=([^;]+)/.exec(document.cookie)?.[1];
  let id: string | null = null;
  try {
    if (valid(fromUrl)) localStorage.setItem(INSTALL_KEY, fromUrl);
    id = localStorage.getItem(INSTALL_KEY);
  } catch {
    id = valid(fromUrl) ? fromUrl : null;
  }
  id = valid(fromUrl) ? fromUrl : valid(id) ? id : valid(fromCookie) ? fromCookie : null;
  if (id) rememberCommunity(id);
  return id;
}

/**
 * Tell the server which community this device belongs to (living_c cookie —
 * nginx serves that community's manifest at /manifest.webmanifest) and make the
 * browser re-read the manifest now. Done at startup, before the install
 * prompt is built, so "Add to Home screen" offers the community's name and icon.
 */
function rememberCommunity(id: string) {
  if (!/(?:^|;\s*)living_c=/.test(document.cookie) || !document.cookie.includes(`living_c=${id}`)) {
    document.cookie = `living_c=${id}; path=/; max-age=31536000; SameSite=Lax; Secure`;
  }
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link && !link.getAttribute('href')?.includes('?')) {
    link.setAttribute('crossorigin', 'use-credentials');
    link.setAttribute('href', `/manifest.webmanifest?c=${id}`);
  }
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

/**
 * The community's logo, centred and prominent, for app headers. Keeps the
 * logo's aspect ratio (object-contain) and transparency; never stretches.
 * Falls back to the Living mark when there is no logo or it fails to load.
 */
export function BrandMark({
  logoUrl,
  name,
  className,
}: {
  logoUrl?: string | null;
  name?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logoUrl]);

  return (
    <div className={cn('flex w-full justify-center py-2', className)}>
      {logoUrl && !failed ? (
        <img
          src={logoUrl}
          alt={name ? `${name} logo` : 'Community logo'}
          className="h-20 w-auto max-w-[min(75vw,280px)] object-contain sm:h-24"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex items-center gap-2" aria-label="Living">
          <img src="/icon.svg" alt="" className="h-11 w-11 rounded-xl" />
          <span className="font-display text-h3 tracking-tight text-strong">Living</span>
        </span>
      )}
    </div>
  );
}
