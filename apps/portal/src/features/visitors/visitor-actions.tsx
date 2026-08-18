import { Check, LogOut, X } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import type { GateEntry } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, toast, useConfirm } from '@living/ui';

import { useVisitorMutations } from './lib';

/**
 * Lifecycle actions for a visitor, now on the gate entry lifecycle.
 *
 * Two things changed with the move off the old `visitors` table. The permission
 * is `gate:entry:update`, which SECURITY and the community admin both hold — so
 * either can decide a visit, which is the point. And check-in/check-out
 * collapsed into COMPLETED: the gate lifecycle records an arrival being dealt
 * with, and the separate half-state only existed in the table that is going
 * away.
 */
export function VisitorActions({
  visitor, onDone, size = 'sm',
}: {
  visitor: GateEntry;
  onDone?: () => void;
  size?: 'sm' | 'md';
}) {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const m = useVisitorMutations(visitor.id);
  const busy = m.approve.isPending || m.reject.isPending || m.complete.isPending;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); onDone?.(); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not update'); }
  };

  const onReject = async () => {
    if (!(await confirm({ title: `Reject ${visitor.personName}?`, tone: 'danger', confirmLabel: 'Reject' }))) return;
    await run(() => m.reject.mutateAsync(undefined), 'Visitor rejected');
  };

  const canDecide = hasPermission('gate:entry:update');
  const canComplete = hasPermission('gate:entry:complete');
  const s = visitor.status;

  const buttons = [];
  // CREATED and NOTIFIED are both "waiting on a decision" — a visit raised by a
  // resident sits in CREATED until the notification job drains, and it must be
  // decidable in the meantime rather than looking inert.
  if ((s === 'CREATED' || s === 'NOTIFIED') && canDecide) {
    buttons.push(
      <Button key="a" size={size} loading={m.approve.isPending} onClick={() => run(() => m.approve.mutateAsync(undefined), 'Approved')}>
        <Check className="h-4 w-4" /> Approve
      </Button>,
    );
    buttons.push(
      <Button key="r" size={size} variant="ghost" disabled={busy} onClick={onReject}>
        <X className="h-4 w-4" /> Reject
      </Button>,
    );
  }
  if (s === 'APPROVED' && canComplete) {
    buttons.push(
      <Button key="done" size={size} loading={m.complete.isPending} onClick={() => run(() => m.complete.mutateAsync(), 'Visit closed')}>
        <LogOut className="h-4 w-4" /> Mark done
      </Button>,
    );
  }
  if (buttons.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-2">{buttons}</div>;
}
