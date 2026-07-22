import { type ComponentType, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, ClipboardList, LifeBuoy, Wrench } from 'lucide-react';
import { Badge, type BadgeProps } from '@living/ui';
import { cn, timeAgo } from '@living/utils';

import type { JobKind } from './execution';
import type { Job } from './jobs';

type Tone = NonNullable<BadgeProps['tone']>;

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: 'neutral', OPEN: 'info', REQUESTED: 'info', ASSIGNED: 'brand', ACCEPTED: 'brand',
  SCHEDULED: 'info', IN_PROGRESS: 'warning', ON_HOLD: 'neutral', COMPLETED: 'success',
  VERIFIED: 'success', RESOLVED: 'success', CLOSED: 'neutral', CANCELLED: 'neutral', REJECTED: 'danger',
};
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export function StatusPill({ status, size = 'sm' }: { status: string; size?: BadgeProps['size'] }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} size={size} dot>{humanize(status)}</Badge>;
}

const PRIORITY_TONE: Record<string, Tone> = {
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};
export function PriorityPill({ priority, size = 'sm' }: { priority: string; size?: BadgeProps['size'] }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? 'neutral'} size={size} dot>{humanize(priority)}</Badge>;
}

export const KIND_META: Record<JobKind, { label: string; icon: ComponentType<{ className?: string }> }> = {
  'work-order': { label: 'Work order', icon: Wrench },
  'service-request': { label: 'Service', icon: ClipboardList },
  ticket: { label: 'Ticket', icon: LifeBuoy },
};

/** A titled section with a soft heading and optional count/action. */
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

/**
 * The core work item — a big, one-thumb-tappable card. Kind icon + priority up
 * front, status pill trailing, unit and age as context. Min height comfortably
 * clears the 44px touch-target floor.
 */
export function JobCard({ job, emphasis }: { job: Job; emphasis?: boolean }) {
  const reduced = useReducedMotion();
  const { icon: Icon, label } = KIND_META[job.kind];
  const critical = job.priority === 'CRITICAL' || job.priority === 'HIGH';
  return (
    <Link to={job.detailPath as string} className="block focus-visible:outline-none focus-visible:shadow-ring rounded-card">
      <motion.div
        whileTap={reduced ? undefined : { scale: 0.99 }}
        transition={{ duration: 0.14 }}
        className={cn(
          'flex min-h-[76px] items-center gap-3.5 rounded-card bg-card p-4 shadow-sm',
          emphasis && 'ring-1 ring-inset ring-[var(--brand-primary)]/25',
        )}
      >
        <span className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
          critical ? 'bg-[var(--danger-bg)] text-[var(--danger-fg,var(--danger))]' : 'bg-tint text-brand',
        )}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-strong">{job.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            <span className="font-mono">{job.number}</span>
            {job.unitLabel && <> · Unit {job.unitLabel}</>} · {label} · {timeAgo(job.updatedAt)}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <StatusPill status={job.status} />
            {critical && <PriorityPill priority={job.priority} />}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-subtle" />
      </motion.div>
    </Link>
  );
}

/** Shown when a signed-in user has no linked staff/vendor profile, so we can't
 *  resolve their assigned work. High-contrast, tells them exactly what to do. */
export function ProfileNotLinked() {
  return (
    <div className="mx-4 mt-10 flex flex-col items-center gap-3 rounded-card border border-border bg-card p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning-bg)] text-[var(--warning-fg,var(--warning))]">
        <Wrench className="h-6 w-6" />
      </span>
      <h2 className="font-display text-h4 tracking-tight text-strong">Account not linked yet</h2>
      <p className="text-sm text-muted">
        We couldn’t match your login to a staff or vendor profile in this community.
        Ask your facility manager to link your account, then sign in again.
      </p>
    </div>
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
