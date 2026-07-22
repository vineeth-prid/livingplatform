import { Badge, type BadgeProps } from '@living/ui';

type Tone = NonNullable<BadgeProps['tone']>;

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

/** A status badge driven by a per-module tone map. One component, both modules. */
export function StatusPill({
  status, tones, size = 'sm',
}: {
  status: string;
  tones: Record<string, Tone>;
  size?: BadgeProps['size'];
}) {
  return <Badge tone={tones[status] ?? 'neutral'} size={size} dot>{humanize(status)}</Badge>;
}

/** Priority reuses the ticket tones — shared across all operational entities. */
const PRIORITY_TONE: Record<string, Tone> = {
  LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger',
};
export function PriorityPill({ priority, size = 'sm' }: { priority: string; size?: BadgeProps['size'] }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? 'neutral'} size={size} dot>{humanize(priority)}</Badge>;
}
