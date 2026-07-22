import { type ComponentType, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Badge, type BadgeProps } from '@living/ui';
import { cn } from '@living/utils';

type Tone = NonNullable<BadgeProps['tone']>;

// Calm, consumer tones — an active request reads friendly, not alarming.
const TONE: Record<string, Tone> = {
  OPEN: 'info', REQUESTED: 'info', ASSIGNED: 'brand', ACCEPTED: 'brand', SCHEDULED: 'info',
  IN_PROGRESS: 'warning', ON_HOLD: 'neutral', RESOLVED: 'success', COMPLETED: 'success',
  VERIFIED: 'success', CLOSED: 'neutral', CANCELLED: 'neutral', REJECTED: 'danger', DRAFT: 'neutral',
};
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export function StatusPill({ status, size = 'sm' }: { status: string; size?: BadgeProps['size'] }) {
  return <Badge tone={TONE[status] ?? 'neutral'} size={size} dot>{humanize(status)}</Badge>;
}

/** A titled section with a soft heading. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="font-display text-h4 tracking-tight text-strong">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Big, tappable quick-action tile (min 44px, one-handed). */
export function QuickAction({
  icon: Icon, label, to, onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  to?: string;
  onClick?: () => void;
}) {
  const reduced = useReducedMotion();
  const inner = (
    <motion.div
      whileTap={reduced ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-2 rounded-card bg-card p-3 shadow-sm"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-tint text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-center text-xs font-medium leading-tight text-body">{label}</span>
    </motion.div>
  );
  return to ? (
    <Link to={to} className="focus-visible:outline-none focus-visible:shadow-ring rounded-card">{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className="focus-visible:outline-none focus-visible:shadow-ring rounded-card">{inner}</button>
  );
}

/** A request/booking card row that navigates to its detail. */
export function ListCard({
  to, onClick, leading, title, subtitle, trailing, className,
}: {
  to?: string;
  onClick?: () => void;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const body = (
    <motion.div
      whileTap={reduced ? undefined : { scale: 0.99 }}
      transition={{ duration: 0.14 }}
      className={cn('flex items-center gap-3 rounded-card bg-card p-4 shadow-sm', className)}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-strong">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-subtle" />}
    </motion.div>
  );
  return to ? (
    <Link to={to} className="block focus-visible:outline-none">{body}</Link>
  ) : (
    <button type="button" onClick={onClick} className="block w-full text-left focus-visible:outline-none">{body}</button>
  );
}

/** A gentle placeholder block for features arriving later. */
export function SoftPlaceholder({ icon: Icon, title, note }: { icon: ComponentType<{ className?: string }>; title: string; note: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-dashed border-border bg-transparent p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-subtle"><Icon className="h-5 w-5" /></span>
      <div>
        <p className="text-sm font-medium text-body">{title}</p>
        <p className="text-xs text-subtle">{note}</p>
      </div>
    </div>
  );
}
