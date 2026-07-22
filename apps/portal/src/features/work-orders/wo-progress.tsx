import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gauge, Lock } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { cn, timeAgo } from '@living/utils';
import { Avatar, Badge, Button, EmptyState, Skeleton, toast } from '@living/ui';

import { living } from '../../lib/living';
import { ProgressMeter } from '../operations';
import { useWorkOrderMutations } from './queries';

/**
 * Progress updates: the latest percentage as a meter, the update history
 * (comment + %, internal-note aware), and a composer. This is the work order's
 * activity log (the engine has no separate comments).
 */
export function WorkOrderProgress({ workOrderId }: { workOrderId: string }) {
  const { hasPermission, session } = useAuth();
  const { addUpdate } = useWorkOrderMutations(workOrderId);
  const [comment, setComment] = useState('');
  const [percent, setPercent] = useState('');
  const [internal, setInternal] = useState(false);
  const canUpdate = hasPermission('workorder:update');
  const meId = session?.user.id;

  const q = useQuery({ queryKey: ['work-order', workOrderId, 'updates'], queryFn: () => living.workOrder.listUpdates(workOrderId) });
  const updates = q.data ?? [];
  const latestPercent = [...updates].reverse().find((u) => u.progressPercent != null)?.progressPercent;

  async function submit() {
    const text = comment.trim();
    if (!text) return;
    try {
      await addUpdate.mutateAsync({
        comment: text,
        progressPercent: percent !== '' ? Math.max(0, Math.min(100, Number(percent))) : undefined,
        isInternal: internal,
      });
      setComment(''); setPercent(''); setInternal(false);
      await q.refetch();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add update');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {latestPercent != null && <ProgressMeter percent={latestPercent} />}

      {q.isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : updates.length === 0 ? (
        <EmptyState icon={Gauge} title="No updates yet" description="Post progress as work happens." />
      ) : (
        <ul className="flex flex-col gap-3">
          {updates.map((u) => (
            <li key={u.id} className="flex gap-3">
              <Avatar name={u.authorId === meId ? (session?.user.firstName ?? 'You') : 'User'} size="sm" />
              <div className={cn('flex-1 rounded-lg px-3.5 py-2.5', u.isInternal ? 'bg-[var(--warning-bg)]' : 'bg-sunken')}>
                <div className="mb-1 flex items-center gap-2">
                  {u.progressPercent != null && <Badge tone="brand" size="sm">{u.progressPercent}%</Badge>}
                  {u.isInternal && <Badge tone="warning" size="sm"><Lock className="h-3 w-3" /> Internal</Badge>}
                  <span className="text-2xs text-subtle">{timeAgo(u.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-body">{u.comment}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpdate && (
        <div className="rounded-control border border-border bg-raised p-2 focus-within:shadow-ring">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Post a progress update…" rows={2}
            className="w-full resize-none bg-transparent px-1.5 py-1 text-sm text-strong outline-none placeholder:text-subtle" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)}
                  placeholder="%" className="h-8 w-16 rounded-md border border-border bg-page px-2 text-sm text-strong outline-none" />
                progress
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-[var(--brand-primary)]" />
                Internal
              </label>
            </div>
            <Button size="sm" onClick={submit} loading={addUpdate.isPending} disabled={!comment.trim()}>Post update</Button>
          </div>
        </div>
      )}
    </div>
  );
}
