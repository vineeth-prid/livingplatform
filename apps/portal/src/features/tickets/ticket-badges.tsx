import { Badge, type BadgeProps } from '@living/ui';
import type { TicketPriority, TicketStatus } from '@living/types';

type Tone = NonNullable<BadgeProps['tone']>;

const STATUS_TONE: Record<TicketStatus, Tone> = {
  OPEN: 'info',
  ASSIGNED: 'brand',
  IN_PROGRESS: 'warning',
  ON_HOLD: 'neutral',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'danger',
};

const PRIORITY_TONE: Record<TicketPriority, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export function TicketStatusBadge({ status, size = 'sm' }: { status: TicketStatus; size?: BadgeProps['size'] }) {
  return <Badge tone={STATUS_TONE[status]} size={size} dot>{humanize(status)}</Badge>;
}

export function PriorityBadge({ priority, size = 'sm' }: { priority: TicketPriority; size?: BadgeProps['size'] }) {
  return <Badge tone={PRIORITY_TONE[priority]} size={size} dot>{humanize(priority)}</Badge>;
}
