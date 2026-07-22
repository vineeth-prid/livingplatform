import { Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { useState } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { formatDateTime, timeAgo } from '@living/utils';
import {
  Avatar, Button, Card, EmptyState, LoadingState, Timeline, toast, type TimelineItem,
} from '@living/ui';
import type { ServiceRequest, Ticket, TimelineEvent } from '@living/types';

import { living } from '../lib/living';
import { StatusPill } from '../components';

const eventLabel = (e: TimelineEvent) =>
  e.type === 'STATUS_CHANGED' && e.reference
    ? `Status: ${e.reference.replace('->', ' → ').toLowerCase()}`
    : e.type.charAt(0) + e.type.slice(1).toLowerCase().replace(/_/g, ' ');

interface RequestDetail {
  title: string;
  description: string;
  status: string;
  ticketNumber?: string;
  requestNumber?: string;
  comments?: TicketCommentLite[];
  timeline?: TimelineEvent[];
}

/** One detail screen for both a resident's ticket and service request. */
export function RequestDetailScreen() {
  const params = useParams({ strict: false }) as { kind?: string; id?: string };
  const kind = params.kind === 'service' ? 'service' : 'ticket';
  const id = params.id ?? '';

  const q = useQuery<Ticket | ServiceRequest>({
    queryKey: ['request', kind, id],
    queryFn: () => (kind === 'ticket' ? living.ticket.get(id) : living.serviceRequest.get(id)),
  });
  const data = q.data as unknown as RequestDetail | undefined;
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  return (
    <div className="min-h-dvh">
      <Link to={'/requests' as string} className="inline-flex items-center gap-1.5 px-4 pt-6 text-sm text-muted">
        <ArrowLeft className="h-4 w-4" /> My requests
      </Link>

      {q.isLoading ? (
        <LoadingState />
      ) : notFound ? (
        <EmptyState title="Not found" description="This request no longer exists." />
      ) : data ? (
        <div className="flex flex-col gap-4 px-4 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-h2 leading-tight tracking-tight text-strong">{data.title}</h1>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StatusPill status={data.status} size="md" />
              <span className="font-mono text-xs text-subtle">{data.ticketNumber ?? data.requestNumber}</span>
            </div>
          </div>

          <Card variant="elevated">
            <p className="whitespace-pre-wrap text-sm text-body">{data.description}</p>
          </Card>

          {kind === 'ticket' && <Comments ticketId={id} comments={(data.comments as TicketCommentLite[]) ?? []} />}

          <Card variant="elevated">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-subtle">Timeline</h2>
            {data.timeline && data.timeline.length > 0 ? (
              <Timeline items={data.timeline.map<TimelineItem>((e) => ({ id: e.id, title: eventLabel(e), timestamp: timeAgo(e.createdAt) }))} />
            ) : (
              <p className="text-sm text-subtle">Updates will appear here.</p>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

interface TicketCommentLite { id: string; body: string; isInternal: boolean; authorId: string; createdAt: string }

/** A resident can read public comments and reply (never sees internal notes). */
function Comments({ ticketId, comments }: { ticketId: string; comments: TicketCommentLite[] }) {
  const { session } = useAuth();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['request', 'ticket', ticketId, 'comments'], queryFn: () => living.ticket.listComments(ticketId), initialData: comments });
  const visible = (q.data ?? comments).filter((c) => !c.isInternal);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await living.ticket.addComment(ticketId, text);
      setBody('');
      await q.refetch();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not send');
    } finally { setBusy(false); }
  }

  return (
    <Card variant="elevated">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-subtle">Messages</h2>
      {visible.length === 0 ? (
        <p className="mb-3 text-sm text-subtle">No messages yet.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-3">
          {visible.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar name={c.authorId === session?.user.id ? (session?.user.firstName ?? 'You') : 'Team'} size="sm" />
              <div className="flex-1 rounded-lg bg-sunken px-3 py-2">
                <p className="whitespace-pre-wrap text-sm text-body">{c.body}</p>
                <span className="text-2xs text-subtle">{timeAgo(c.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} placeholder="Write a message…"
          className="min-h-11 flex-1 resize-none rounded-control border border-border bg-raised px-3 py-2.5 text-sm text-strong outline-none focus-visible:shadow-ring" />
        <Button size="icon" onClick={send} loading={busy} disabled={!body.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
