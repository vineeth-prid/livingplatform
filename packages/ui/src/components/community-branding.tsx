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
    setLink('manifest', `/brand/${data.communityId}/manifest.webmanifest?app=${app}&v=${v}`);
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
  const fromUrl = new URLSearchParams(window.location.search).get('c');
  try {
    if (fromUrl && /^[a-z0-9]{20,40}$/i.test(fromUrl)) localStorage.setItem(INSTALL_KEY, fromUrl);
    return localStorage.getItem(INSTALL_KEY);
  } catch {
    return fromUrl;
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
