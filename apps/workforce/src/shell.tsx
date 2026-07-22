import { Suspense, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useRouterState } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, CalendarCheck, CloudOff, ListChecks, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { LoadingState } from '@living/ui';
import { cn } from '@living/utils';

import { useOnlineStatus } from './offline';

const TABS = [
  { to: '/', label: 'Today', icon: CalendarCheck, match: (p: string) => p === '/' },
  { to: '/jobs', label: 'Jobs', icon: ListChecks, match: (p: string) => p.startsWith('/jobs') },
  { to: '/gate', label: 'Gate', icon: ShieldCheck, match: (p: string) => p.startsWith('/gate') },
  { to: '/activity', label: 'Activity', icon: Activity, match: (p: string) => p.startsWith('/activity') },
  { to: '/profile', label: 'Profile', icon: User, match: (p: string) => p.startsWith('/profile') },
] as const;

/** The mobile field shell: a scrollable page over a fixed bottom tab bar,
 *  centred and framed on tablet/desktop. */
export function MobileShell() {
  const { status } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (status === 'loading') return <LoadingState className="h-dvh" label="Loading your work…" />;
  if (status === 'unauthenticated') return <Navigate to="/login" />;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-page sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border sm:border-border-subtle sm:shadow-lg sm:overflow-hidden">
      <OfflineBanner />
      <main className="flex-1 overflow-y-auto overscroll-contain pb-24">
        <PageFade key={pathname}>
          <Suspense fallback={<LoadingState className="mt-20" label="Loading…" />}>
            <Outlet />
          </Suspense>
        </PageFade>
      </main>
      <BottomNav pathname={pathname} />
    </div>
  );
}

/** A persistent, high-contrast banner when the device drops offline — the app
 *  keeps working from cache and queues changes, so this reassures rather than blocks. */
function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-[var(--warning-bg)] px-4 py-1.5 text-xs font-medium text-[var(--warning-fg,var(--warning))]"
    >
      <CloudOff className="h-3.5 w-3.5" /> Offline — showing your last sync. Changes will send when you reconnect.
    </div>
  );
}

function PageFade({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary"
      className="absolute inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-raised/90 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to as string}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 focus-visible:outline-none"
              >
                <t.icon className={cn('h-5 w-5 transition-colors', active ? 'text-brand' : 'text-subtle')} />
                <span className={cn('text-2xs font-medium transition-colors', active ? 'text-brand' : 'text-subtle')}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A screen header with a title and optional subtitle/right slot. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pb-3 pt-6">
      <div>
        {subtitle && <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">{subtitle}</p>}
        <h1 className="font-display text-h2 leading-none tracking-tight text-strong">{title}</h1>
      </div>
      {right}
    </header>
  );
}
