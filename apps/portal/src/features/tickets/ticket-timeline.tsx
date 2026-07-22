import { type ReactNode } from 'react';
import {
  CheckCircle2, CircleDot, FileUp, MessageSquare, RefreshCw, UserPlus, XCircle,
} from 'lucide-react';
import { timeAgo } from '@living/utils';
import { EmptyState, Timeline, type TimelineItem } from '@living/ui';
import type { TimelineEvent } from '@living/types';

const ICON: Record<string, ReactNode> = {
  CREATED: <CircleDot className="h-3 w-3" />,
  ASSIGNED: <UserPlus className="h-3 w-3" />,
  REASSIGNED: <UserPlus className="h-3 w-3" />,
  STATUS_CHANGED: <RefreshCw className="h-3 w-3" />,
  COMMENT_ADDED: <MessageSquare className="h-3 w-3" />,
  ATTACHMENT_ADDED: <FileUp className="h-3 w-3" />,
  RESOLVED: <CheckCircle2 className="h-3 w-3" />,
  CLOSED: <CheckCircle2 className="h-3 w-3" />,
  REOPENED: <RefreshCw className="h-3 w-3" />,
  CANCELLED: <XCircle className="h-3 w-3" />,
};

/** The engine stores structured events (type + actor + reference); we compose
 *  the human sentence here and reuse the shared Timeline. */
function describe(e: TimelineEvent): string {
  switch (e.type) {
    case 'CREATED': return 'Ticket created';
    case 'ASSIGNED': return 'Assigned';
    case 'REASSIGNED': return 'Reassigned';
    case 'STATUS_CHANGED': return e.reference ? `Status: ${e.reference.replace('->', ' → ').toLowerCase()}` : 'Status changed';
    case 'COMMENT_ADDED': return 'Comment added';
    case 'ATTACHMENT_ADDED': return 'Attachment uploaded';
    case 'RESOLVED': return 'Resolved';
    case 'CLOSED': return 'Closed';
    case 'REOPENED': return 'Reopened';
    case 'CANCELLED': return 'Cancelled';
    default: return e.type.replace(/_/g, ' ').toLowerCase();
  }
}

export function TicketTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <EmptyState title="No history yet" />;
  const items: TimelineItem[] = events.map((e) => ({
    id: e.id,
    icon: ICON[e.type],
    title: describe(e),
    timestamp: timeAgo(e.createdAt),
  }));
  return <Timeline items={items} />;
}
