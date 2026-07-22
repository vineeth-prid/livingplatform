import { Badge, type BadgeProps } from '@living/ui';

type Tone = NonNullable<BadgeProps['tone']>;

/** Domain status → badge tone. Covers every master-data enum in one place so
 *  status colour is consistent across all modules. */
const TONE: Record<string, Tone> = {
  // Community / hierarchy / unit
  ACTIVE: 'success', ONBOARDING: 'info', INACTIVE: 'neutral', ARCHIVED: 'neutral',
  OCCUPIED: 'success', VACANT: 'neutral', RESERVED: 'info', UNDER_MAINTENANCE: 'warning',
  // People
  MOVED_OUT: 'neutral',
  // Ownership
  OWNER_OCCUPIED: 'brand', TENANTED: 'info', UNKNOWN: 'neutral',
};

function humanize(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** A status pill with a consistent tone + human label. */
export function StatusBadge({ status, size = 'sm' }: { status: string; size?: BadgeProps['size'] }) {
  return (
    <Badge tone={TONE[status] ?? 'neutral'} size={size} dot>
      {humanize(status)}
    </Badge>
  );
}
