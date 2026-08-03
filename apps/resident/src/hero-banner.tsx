import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Megaphone, Sparkles } from 'lucide-react';
import { Skeleton } from '@living/ui';

import { useResidentCommunity } from './community';
import { living } from './lib/living';

interface ConfiguredBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageKey?: string;
  actionUrl?: string;
  kind?: 'announcement' | 'ad';
  sortOrder?: number;
}

interface Slide {
  id: string;
  title: string;
  subtitle?: string;
  actionUrl?: string;
  kind: 'announcement' | 'ad';
}

const ROTATE_MS = 6000;

/**
 * The rotating hero at the top of the resident home.
 *
 * Two sources, one carousel: live published announcements (so an urgent notice
 * always surfaces without anyone editing settings) plus the community's own
 * configured slides for offers. Announcements come first because they are the
 * thing a resident actually needs to know.
 *
 * Renders nothing at all when there is neither — an empty decorative band at the
 * top of the screen is worse than no band.
 */
export function HeroBanner() {
  const { communityId, community } = useResidentCommunity();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  const announcements = useQuery({
    queryKey: ['announcements', 'hero', communityId],
    queryFn: () =>
      living.announcements.list({
        communityId: communityId!,
        publishedOnly: true,
        limit: 5,
        sortBy: 'publishAt',
        sortDir: 'desc',
      }),
    enabled: !!communityId,
  });

  const settings = useQuery({
    queryKey: ['community', communityId, 'home-banners'],
    queryFn: () => living.community.getSettings<{ homeBanners: ConfiguredBanner[] | null }>(communityId!),
    enabled: !!communityId,
    staleTime: 5 * 60_000,
  });

  const slides = useMemo<Slide[]>(() => {
    const notices: Slide[] = (announcements.data?.items ?? []).slice(0, 3).map((a) => ({
      id: `announcement-${a.id}`,
      title: a.title,
      subtitle: a.content?.slice(0, 90) ?? undefined,
      actionUrl: '/announcements',
      kind: 'announcement' as const,
    }));
    const configured: Slide[] = (settings.data?.homeBanners ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        actionUrl: b.actionUrl,
        kind: b.kind ?? 'ad',
      }));
    return [...notices, ...configured];
  }, [announcements.data, settings.data]);

  // Rotate, but never while the user has reduced motion on.
  useEffect(() => {
    if (reduced || slides.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [reduced, slides.length]);

  // Keep the index valid if the slide set shrinks between renders.
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  if (announcements.isLoading || settings.isLoading) {
    return <Skeleton className="mb-5 h-24 rounded-card" />;
  }
  if (slides.length === 0) return null;

  const slide = slides[index]!;
  const Icon = slide.kind === 'announcement' ? Megaphone : Sparkles;

  const body = (
    <div className="relative overflow-hidden rounded-card bg-tint px-4 py-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={reduced ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start gap-3"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-brand">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--text-on-tint)] opacity-70">
              {slide.kind === 'announcement' ? 'Announcement' : (community?.name ?? 'Living')}
            </p>
            <p className="truncate font-display text-h4 leading-tight tracking-tight text-[var(--text-on-tint)]">
              {slide.title}
            </p>
            {slide.subtitle && (
              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-on-tint)] opacity-80">
                {slide.subtitle}
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Banner slides">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              onClick={(e) => {
                e.preventDefault();
                setIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? 'w-5 bg-[var(--text-on-tint)] opacity-90'
                  : 'w-1.5 bg-[var(--text-on-tint)] opacity-40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mb-5">
      {slide.actionUrl ? (
        <Link
          to={slide.actionUrl as string}
          className="block rounded-card focus-visible:outline-none focus-visible:shadow-ring"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}
