import { Check, LogIn, LogOut, X } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, toast, useConfirm } from '@living/ui';
import type { Visitor } from '@living/types';

import { useVisitorMutations } from './lib';

/** The lifecycle actions available for a visitor, gated by status + permission.
 *  Shared by the queue (workforce mirrors this) and the portal detail. */
export function VisitorActions({ visitor, onDone, size = 'sm' }: { visitor: Visitor; onDone?: () => void; size?: 'sm' | 'md' }) {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const m = useVisitorMutations(visitor.id);
  const busy = m.approve.isPending || m.reject.isPending || m.checkIn.isPending || m.checkOut.isPending;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); onDone?.(); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not update'); }
  };
  const onReject = async () => {
    if (!(await confirm({ title: `Reject ${visitor.visitorName}?`, tone: 'danger', confirmLabel: 'Reject' }))) return;
    await run(() => m.reject.mutateAsync(undefined), 'Visitor rejected');
  };

  const canApprove = hasPermission('visitor:approve');
  const canCheckIn = hasPermission('visitor:checkin');
  const canCheckOut = hasPermission('visitor:checkout');
  const s = visitor.status;

  const buttons = [];
  if (s === 'PENDING' && canApprove) {
    buttons.push(<Button key="a" size={size} loading={m.approve.isPending} onClick={() => run(() => m.approve.mutateAsync(), 'Approved')}><Check className="h-4 w-4" /> Approve</Button>);
    buttons.push(<Button key="r" size={size} variant="ghost" disabled={busy} onClick={onReject}><X className="h-4 w-4" /> Reject</Button>);
  }
  if (s === 'APPROVED' && canCheckIn) {
    buttons.push(<Button key="in" size={size} loading={m.checkIn.isPending} onClick={() => run(() => m.checkIn.mutateAsync(), 'Checked in')}><LogIn className="h-4 w-4" /> Check in</Button>);
  }
  if (s === 'CHECKED_IN' && canCheckOut) {
    buttons.push(<Button key="out" size={size} loading={m.checkOut.isPending} onClick={() => run(() => m.checkOut.mutateAsync(), 'Checked out')}><LogOut className="h-4 w-4" /> Check out</Button>);
  }
  if (buttons.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-2">{buttons}</div>;
}
