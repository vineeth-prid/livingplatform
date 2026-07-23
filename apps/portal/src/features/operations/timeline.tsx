import { type ReactNode } from 'react';
import {
  CheckCircle2, CircleDot, FileUp, Gauge, MessageSquare, Pause, Play,
  RefreshCw, ShieldCheck, UserPlus, XCircle,
} from 'lucide-react';
import { timeAgo } from '@living/utils';
import { EmptyState, Timeline, type TimelineItem } from '@living/ui';
import type { TimelineEvent } from '@living/types';

// Covers ticket, service-request and work-order event types.
const ICON: Record<string, ReactNode> = {
  CREATED: <CircleDot className="h-3 w-3" />,
  RECOMMENDED: <CircleDot className="h-3 w-3" />,
  APPROVED: <CheckCircle2 className="h-3 w-3" />,
  REJECTED: <XCircle className="h-3 w-3" />,
  UPDATED: <RefreshCw className="h-3 w-3" />,
  ASSIGNED: <UserPlus className="h-3 w-3" />,
  REASSIGNED: <UserPlus className="h-3 w-3" />,
  UNASSIGNED: <UserPlus className="h-3 w-3" />,
  ACCEPTED: <CheckCircle2 className="h-3 w-3" />,
  STARTED: <Play className="h-3 w-3" />,
  RESUMED: <Play className="h-3 w-3" />,
  ON_HOLD: <Pause className="h-3 w-3" />,
  PROGRESS_UPDATED: <Gauge className="h-3 w-3" />,
  STATUS_CHANGED: <RefreshCw className="h-3 w-3" />,
  COMMENT_ADDED: <MessageSquare className="h-3 w-3" />,
  ATTACHMENT_ADDED: <FileUp className="h-3 w-3" />,
  RESOLVED: <CheckCircle2 className="h-3 w-3" />,
  COMPLETED: <CheckCircle2 className="h-3 w-3" />,
  VERIFIED: <ShieldCheck className="h-3 w-3" />,
  CLOSED: <CheckCircle2 className="h-3 w-3" />,
  REOPENED: <RefreshCw className="h-3 w-3" />,
  CANCELLED: <XCircle className="h-3 w-3" />,
};

function describe(e: TimelineEvent): string {
  if (e.type === 'STATUS_CHANGED' && e.reference)
    return `Status: ${e.reference.replace('->', ' → ').toLowerCase()}`;
  if (e.type === 'PROGRESS_UPDATED') {
    const pct = (e.metadata as { progressPercent?: number } | null)?.progressPercent;
    return pct != null ? `Progress updated — ${pct}%` : 'Progress updated';
  }
  return e.type.charAt(0) + e.type.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** Structured event log → the shared Timeline. Reused by tickets, SR and WO. */
export function OperationsTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <EmptyState title="No history yet" />;
  const items: TimelineItem[] = events.map((e) => ({
    id: e.id, icon: ICON[e.type], title: describe(e), timestamp: timeAgo(e.createdAt),
  }));
  return <Timeline items={items} />;
}
