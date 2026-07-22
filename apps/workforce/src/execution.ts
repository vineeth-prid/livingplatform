import type { Permission } from '@living/types';

/**
 * The execution workflow, from the WORKER's point of view. A client mirror of
 * the three backend status services (Ticket / ServiceRequest / WorkOrder),
 * narrowed to the handful of moves a field worker actually makes: accept, start,
 * pause, resume, complete, resolve, reject.
 *
 * Admin-only moves (assign, schedule, verify, close, cancel, draft) are NOT
 * offered here — those live in the portal. The result is "what can I do next to
 * this job", already filtered by valid transition AND held permission, so the
 * app never shows a button the backend would reject. Pure + tested.
 */

export type JobKind = 'work-order' | 'service-request' | 'ticket';

export type ActionIntent =
  | 'accept' | 'start' | 'resume' | 'pause' | 'complete' | 'resolve' | 'reject';

export interface ExecAction {
  to: string;
  intent: ActionIntent;
  label: string;
  permission: Permission;
  /** Forward, finishing moves are primary; pause/reject are secondary. */
  primary: boolean;
}

// ── Backend transition maps (mirrors of the *StatusService transitions) ───────

const TRANSITIONS: Record<JobKind, Record<string, string[]>> = {
  'work-order': {
    DRAFT: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
    ACCEPTED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    COMPLETED: ['VERIFIED', 'IN_PROGRESS', 'CANCELLED'],
    VERIFIED: ['CLOSED', 'IN_PROGRESS'],
    CLOSED: [],
    CANCELLED: [],
  },
  'service-request': {
    REQUESTED: ['ASSIGNED', 'CANCELLED', 'REJECTED'],
    ASSIGNED: ['ACCEPTED', 'REJECTED', 'CANCELLED', 'REQUESTED'],
    ACCEPTED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
    SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
    REJECTED: [],
  },
  ticket: {
    OPEN: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'OPEN', 'CANCELLED'],
    IN_PROGRESS: ['ON_HOLD', 'RESOLVED', 'CANCELLED'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    RESOLVED: ['CLOSED', 'IN_PROGRESS'],
    CLOSED: ['IN_PROGRESS'],
    CANCELLED: [],
  },
};

function permissionFor(kind: JobKind, to: string): Permission {
  if (kind === 'work-order') {
    if (to === 'IN_PROGRESS') return 'workorder:start';
    if (to === 'COMPLETED') return 'workorder:complete';
    return 'workorder:update';
  }
  if (kind === 'service-request') {
    if (to === 'COMPLETED') return 'service:complete';
    return 'service:update';
  }
  // ticket
  if (to === 'RESOLVED') return 'ticket:resolve';
  return 'ticket:update';
}

// Only these targets are worker execution verbs; everything else is admin.
const INTENT: Record<string, ActionIntent> = {
  ACCEPTED: 'accept',
  ON_HOLD: 'pause',
  COMPLETED: 'complete',
  RESOLVED: 'resolve',
  REJECTED: 'reject',
  // IN_PROGRESS resolves to start/resume from the source status (see below).
};

const LABEL: Record<ActionIntent, string> = {
  accept: 'Accept job',
  start: 'Start work',
  resume: 'Resume',
  pause: 'Pause',
  complete: 'Complete',
  resolve: 'Resolve',
  reject: 'Reject',
};

// Higher = more prominent. The single highest becomes the primary CTA.
const RANK: Record<ActionIntent, number> = {
  complete: 6, resolve: 6, start: 5, accept: 4, resume: 3, pause: 2, reject: 1,
};

/** The worker's valid + permitted next moves on a job, best action first. */
export function workerActions(
  kind: JobKind,
  status: string,
  permissions: readonly string[],
): ExecAction[] {
  const held = new Set(permissions);
  const nexts = TRANSITIONS[kind][status] ?? [];

  const actions = nexts
    .map<ExecAction | null>((to) => {
      const intent: ActionIntent | undefined =
        to === 'IN_PROGRESS' ? (status === 'ON_HOLD' ? 'resume' : 'start') : INTENT[to];
      if (!intent) return null; // admin-only target — not a worker action
      const permission = permissionFor(kind, to);
      if (!held.has(permission)) return null;
      return { to, intent, label: LABEL[intent], permission, primary: false };
    })
    .filter((a): a is ExecAction => a !== null)
    .sort((a, b) => RANK[b.intent] - RANK[a.intent]);

  const best = actions[0];
  if (best && RANK[best.intent] >= RANK.resume) best.primary = true;
  return actions;
}

const DONE: Record<JobKind, Set<string>> = {
  'work-order': new Set(['COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED']),
  'service-request': new Set(['COMPLETED', 'CANCELLED', 'REJECTED']),
  ticket: new Set(['RESOLVED', 'CLOSED', 'CANCELLED']),
};

/** Whether the worker still has anything to do on this job. */
export function isActive(kind: JobKind, status: string): boolean {
  return !DONE[kind].has(status);
}
