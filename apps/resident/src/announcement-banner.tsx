import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Megaphone, X } from 'lucide-react';
import type { RealtimeEvent } from '@living/living-sdk';
import { useRealtime } from '@living/hooks';

interface Banner {
  title: string;
  body: string;
}

/**
 * A just-published announcement, shown as a banner at the top of the app while
 * it is open. Announcements never go out by WhatsApp or email; when the app is
 * closed the same announcement arrives as a push notification instead.
 */
export function AnnouncementBanner() {
  const qc = useQueryClient();
  const [banner, setBanner] = useState<Banner | null>(null);

  useRealtime({
    onEvent: (event: RealtimeEvent) => {
      if (event.type !== 'announcement.published') return;
      const payload = event.payload as { title?: string; body?: string };
      void qc.invalidateQueries({ queryKey: ['announcements'] });
      setBanner({ title: payload.title ?? 'New announcement', body: payload.body ?? '' });
    },
  });

  // Gone on its own after a while; the announcement stays in the list.
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 12_000);
    return () => clearTimeout(t);
  }, [banner]);

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-md"
        >
          <div className="flex items-start gap-3 rounded-card border border-border-subtle bg-card p-3 shadow-floating">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Megaphone className="h-4 w-4" />
            </span>
            <Link to={'/announcements' as string} onClick={() => setBanner(null)} className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-strong">{banner.title}</p>
              {banner.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{banner.body}</p>}
            </Link>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setBanner(null)}
              className="rounded-md p-1 text-muted hover:bg-sunken hover:text-strong"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
