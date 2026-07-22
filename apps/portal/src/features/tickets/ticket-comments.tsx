import { useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { cn, timeAgo } from '@living/utils';
import { Avatar, Badge, Button, EmptyState, toast } from '@living/ui';
import type { TicketComment } from '@living/types';

import { useTicketMutations } from './queries';

/**
 * Comment thread (newest at bottom) + composer with an internal-note flag.
 * Internal comments are hidden from non-staff by the backend; here they're
 * marked and offered only to users who can comment. (Rich text kept plain;
 * mentions are a future enhancement.)
 */
export function TicketComments({
  ticketId, comments,
}: {
  ticketId: string;
  comments: TicketComment[];
}) {
  const { hasPermission, session } = useAuth();
  const { addComment } = useTicketMutations(ticketId);
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const canComment = hasPermission('ticket:comment');
  const meId = session?.user.id;

  async function submit() {
    const text = body.trim();
    if (!text) return;
    try {
      await addComment.mutateAsync({ body: text, isInternal: internal });
      setBody('');
      setInternal(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add comment');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 ? (
        <EmptyState title="No comments yet" description="Start the conversation below." />
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className={cn('flex gap-3', c.authorId === meId && 'flex-row-reverse text-right')}>
              <Avatar name={c.authorId === meId ? (session?.user.firstName ?? 'You') : 'User'} size="sm" />
              <div className={cn('max-w-[80%] rounded-lg px-3.5 py-2.5', c.isInternal ? 'bg-[var(--warning-bg)]' : 'bg-sunken')}>
                <div className={cn('mb-1 flex items-center gap-2', c.authorId === meId && 'flex-row-reverse')}>
                  {c.isInternal && <Badge tone="warning" size="sm"><Lock className="h-3 w-3" /> Internal</Badge>}
                  <span className="text-2xs text-subtle">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-body">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <div className="rounded-control border border-border bg-raised p-2 focus-within:shadow-ring">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(); }}
            placeholder="Add a comment…  (⌘↵ to send)"
            rows={2}
            className="w-full resize-none bg-transparent px-1.5 py-1 text-sm text-strong outline-none placeholder:text-subtle"
          />
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-[var(--brand-primary)]" />
              Internal note
            </label>
            <Button size="sm" onClick={submit} loading={addComment.isPending} disabled={!body.trim()}>
              <Send className="h-3.5 w-3.5" /> Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
