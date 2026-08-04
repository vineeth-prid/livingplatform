import { Badge, type BadgeProps } from '@living/ui';
import type { GateEntryStatus } from '@living/living-sdk';

type Tone = NonNullable<BadgeProps['tone']>;

export const GATE_STATUS: GateEntryStatus[] = [
  'CREATED',
  'NOTIFIED',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
];

export const GATE_ENTRY_TYPES = ['DELIVERY', 'VISITOR', 'SERVICE_PERSONNEL', 'VEHICLE'];

export const DELIVERY_TYPES = ['FOOD', 'COURIER', 'GROCERY', 'MEDICINE', 'OTHER'];

const STATUS_TONE: Record<string, Tone> = {
  CREATED: 'neutral',
  NOTIFIED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'brand',
  CANCELLED: 'neutral',
};

export const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export function GateStatusBadge({
  status,
  size = 'sm',
}: {
  status: string;
  size?: BadgeProps['size'];
}) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} size={size} dot>
      {humanize(status)}
    </Badge>
  );
}

/** "4m 12s" / "48s" / "—". Approval time is meaningless as a raw second count. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
