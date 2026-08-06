import { useState, type ReactNode } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarClock, Clock, MapPin, Play, ShieldCheck, Star, User, Wrench,
} from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import { Button, Card, EmptyState, LoadingState, toast, useConfirm } from '@living/ui';
import type { Assignee } from '@living/types';

import { KIND_META, PriorityPill, StatusPill } from '../components';
import { type ActionIntent, type JobKind, workerActions } from '../execution';
import { useJob, useJobStatus } from '../jobs';
import { useWorker } from '../worker';
import { RaiseWorkOrderSheet } from '../raise-work-order';
import { living } from '../lib/living';
import {
  MetaRow, PhotoPanel, TicketNotes, TimelinePanel, WorkOrderProgress,
} from '../detail-panels';

const KINDS: JobKind[] = ['work-order', 'service-request', 'ticket'];
const has = (perms: readonly string[] | undefined, p: string) => (perms ?? []).includes(p);

/** A permissive view over the three engines' details — the detail screen reads a
 *  common superset of fields and branches on `kind` for the kind-specific ones. */
interface JobDetail {
  status: string;
  title: string;
  description: string;
  priority: string;
  workOrderNumber?: string;
  requestNumber?: string;
  ticketNumber?: string;
  unitId?: string | null;
  unit?: { unitNumber?: string } | null;
  resident?: { firstName: string; lastName: string } | null;
  assignee?: Assignee | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  dueDate?: string | null;
  preferredDate?: string | null;
  preferredTimeSlot?: string | null;
}

function assigneeName(a: Assignee | null | undefined): string | null {
  if (!a) return null;
  return a.type === 'staff' ? `${a.firstName} ${a.lastName}` : a.name;
}

/** THE primary experience: everything about one job, with the execution actions
 *  up top for the fewest possible taps to move work forward. */
export function JobDetailScreen() {
  const params = useParams({ strict: false }) as { kind?: string; id?: string };
  const kind = (KINDS.includes(params.kind as JobKind) ? params.kind : 'work-order') as JobKind;
  const id = params.id ?? '';
  const { session } = useAuth();
  const perms = session?.permissions;
  const confirm = useConfirm();
  const { communityId } = useWorker();
  const [raising, setRaising] = useState(false);

  const q = useJob(kind, id);
  const status = useJobStatus(kind, id);

  /**
   * A work order raised off THIS job that nobody has decided on yet. Drives both
   * the "waiting for approval" banner and the suppression of a second raise.
   */
  const pendingWoQ = useQuery({
    queryKey: ['job', kind, id, 'pending-wo'],
    queryFn: () => living.workOrder.list(communityId!, { limit: 20, status: 'PENDING_APPROVAL' }),
    enabled: !!communityId && kind !== 'work-order',
  });
  const pendingWo = (pendingWoQ.data?.items ?? []).find(
    (w) => (w as { originId?: string | null }).originId === id,
  );
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  const data = q.data as unknown as JobDetail | undefined;
  const { label: kindLabel, icon: KindIcon } = KIND_META[kind];
  const actions = data ? workerActions(kind, data.status, perms ?? []) : [];

  const number = data?.workOrderNumber ?? data?.requestNumber ?? data?.ticketNumber;
  const residentName = data?.resident ? `${data.resident.firstName} ${data.resident.lastName}` : null;

  async function run(to: string, intent: ActionIntent) {
    if (intent === 'complete' || intent === 'resolve' || intent === 'reject') {
      const ok = await confirm({
        title: intent === 'reject' ? 'Reject this job?' : `Mark ${intent === 'resolve' ? 'resolved' : 'complete'}?`,
        confirmLabel: intent.charAt(0).toUpperCase() + intent.slice(1),
        tone: intent === 'reject' ? 'danger' : 'default',
      });
      if (!ok) return;
    }
    try {
      await status.mutateAsync(to);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not update the job');
    }
  }

  if (q.isLoading) return <LoadingState className="h-dvh" label="Opening job…" />;
  if (notFound || !data) {
    return <EmptyState title="Job not found" description="This job no longer exists or isn’t assigned to you." />;
  }

  return (
    <div className="min-h-dvh pb-4">
      <Link to={'/jobs' as string} className="inline-flex items-center gap-1.5 px-4 pt-6 text-sm text-muted">
        <ArrowLeft className="h-4 w-4" /> Jobs
      </Link>

      {/* Header */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 text-xs text-subtle">
          <KindIcon className="h-4 w-4" /> {kindLabel} · <span className="font-mono">{number}</span>
        </div>
        <h1 className="mt-1.5 font-display text-h2 leading-tight tracking-tight text-strong">{data.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusPill status={data.status} size="md" />
          <PriorityPill priority={data.priority} size="md" />
        </div>
      </div>

      {/* Execution actions — front and centre, fewest taps */}
      {actions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 px-4">
          {actions.filter((a) => a.primary).map((a) => (
            <Button key={a.to} size="lg" block loading={status.isPending} onClick={() => run(a.to, a.intent)}>
              <Play className="h-4 w-4" /> {a.label}
            </Button>
          ))}
          {actions.some((a) => !a.primary) && (
            <div className="flex flex-wrap gap-2">
              {actions.filter((a) => !a.primary).map((a) => (
                <Button key={a.to} variant={a.intent === 'reject' ? 'ghost' : 'secondary'} size="lg" className="flex-1"
                  loading={status.isPending} onClick={() => run(a.to, a.intent)}>
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/*
        Why this job is stuck, in the one place the worker is looking. The API
        refuses to resume a ticket that is awaiting a decision, so without this
        the only feedback would be an error after tapping Resume.
      */}
      {pendingWo && (
        <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-card bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning-fg)]">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{pendingWo.workOrderNumber ?? 'A work order'} is waiting for approval.</strong>{' '}
            This job stays paused until a manager approves or rejects it — you do not need to do
            anything, and it resumes on its own.
          </span>
        </div>
      )}

      {/*
        Raising work off a ticket or request. Not offered on a work order — one
        does not beget another — hidden once the job is finished, and hidden
        while a decision is outstanding: a second estimate for one problem gives
        the manager two answers and leaves whichever they skip pending forever.
      */}
      {kind !== 'work-order' && communityId && !pendingWo && !['COMPLETED', 'CLOSED', 'CANCELLED', 'RESOLVED'].includes(data.status) && (
        <div className="mt-3 px-4">
          <Button variant="secondary" size="lg" block onClick={() => setRaising(true)}>
            <Wrench className="h-4 w-4" /> Raise a work order
          </Button>
          <p className="mt-1.5 text-center text-xs text-subtle">
            Needs parts or paid work? Raise it here — with a cost it goes for approval.
          </p>
        </div>
      )}

      {raising && communityId && (
        <RaiseWorkOrderSheet
          open={raising}
          onOpenChange={setRaising}
          communityId={communityId}
          origin={{
            kind: kind as 'ticket' | 'service-request',
            id,
            title: data.title,
            unitId: data.unitId ?? null,
          }}
        />
      )}

      {/* Verify readiness — display only (verification is a manager action) */}
      {kind === 'work-order' && data.status === 'COMPLETED' && (
        <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-card bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-fg,var(--success))]">
          <ShieldCheck className="h-4 w-4 shrink-0" /> Completed — awaiting verification by the facility manager.
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4 px-4">
        {/* Description */}
        <Card variant="elevated">
          <p className="whitespace-pre-wrap text-sm text-body">{data.description || 'No description provided.'}</p>
        </Card>

        {/* Details */}
        <Card variant="elevated" className="divide-y divide-border-subtle py-0">
          {data.unit?.unitNumber && <MetaRow icon={<MapPin className="h-4 w-4" />} label="Location">Unit {data.unit.unitNumber}</MetaRow>}
          {residentName && <MetaRow icon={<User className="h-4 w-4" />} label="Resident">{residentName}</MetaRow>}
          <MetaRow icon={<Wrench className="h-4 w-4" />} label="Assigned to">{assigneeName(data.assignee) ?? '—'}</MetaRow>
          {kind === 'work-order' && (data.estimatedHours != null || data.actualHours != null) && (
            <MetaRow icon={<Clock className="h-4 w-4" />} label="Hours">
              {data.actualHours ?? 0} / {data.estimatedHours ?? '—'} hrs
            </MetaRow>
          )}
          {kind !== 'service-request' && data.dueDate && (
            <MetaRow icon={<CalendarClock className="h-4 w-4" />} label="Due">{formatDate(data.dueDate)}</MetaRow>
          )}
          {kind === 'service-request' && data.preferredDate && (
            <MetaRow icon={<CalendarClock className="h-4 w-4" />} label="Preferred">
              {formatDate(data.preferredDate)}{data.preferredTimeSlot ? ` · ${data.preferredTimeSlot}` : ''}
            </MetaRow>
          )}
        </Card>

        {/* Progress (WO) / Notes (ticket) */}
        {kind === 'work-order' && (
          <Section title="Progress"><WorkOrderProgress id={id} canUpdate={has(perms, 'workorder:update')} /></Section>
        )}
        {kind === 'ticket' && (
          <Section title="Notes"><TicketNotes id={id} canComment={has(perms, 'ticket:comment')} /></Section>
        )}

        {/* Photos (WO + ticket share the StorageService flow; SR has none) */}
        {/*
          Before and after are separate panels because they are separate
          obligations: a BEFORE photo gates starting, an AFTER photo gates
          completing. One combined list would let a staff member add two "after"
          shots and wonder why Start is still refused.
        */}
        {kind === 'work-order' && (
          <>
            <Section title={data.status === 'ASSIGNED' || data.status === 'ACCEPTED' || data.status === 'APPROVED' ? 'Before photos — required to start' : 'Before photos'}>
              <PhotoPanel
                queryKey={['job', 'work-order', id, 'attachments']}
                canAdd={has(perms, 'workorder:update')}
                stage="BEFORE"
                api={{
                  list: () => living.workOrder.listAttachments(id),
                  uploadUrl: (input) => living.workOrder.attachmentUploadUrl(id, input),
                  add: (input) => living.workOrder.addAttachment(id, input),
                  remove: (attachmentId) => living.workOrder.removeAttachment(id, attachmentId),
                }}
              />
            </Section>
            <Section title={data.status === 'IN_PROGRESS' ? 'After photos — required to complete' : 'After photos'}>
              <PhotoPanel
                queryKey={['job', 'work-order', id, 'attachments']}
                canAdd={has(perms, 'workorder:update')}
                stage="AFTER"
                api={{
                  list: () => living.workOrder.listAttachments(id),
                  uploadUrl: (input) => living.workOrder.attachmentUploadUrl(id, input),
                  add: (input) => living.workOrder.addAttachment(id, input),
                  remove: (attachmentId) => living.workOrder.removeAttachment(id, attachmentId),
                }}
              />
            </Section>
          </>
        )}
        {/* Tickets carry the same obligation as work orders — and this is where
            most staff work actually happens, so gating only work orders left
            the requirement missing exactly where it mattered. */}
        {kind === 'ticket' && (
          <>
            <Section title={['OPEN', 'ASSIGNED'].includes(data.status) ? 'Before photos — required to start' : 'Before photos'}>
              <PhotoPanel
                queryKey={['job', 'ticket', id, 'attachments']}
                canAdd={has(perms, 'ticket:update')}
                stage="BEFORE"
                api={{
                  list: () => living.ticket.listAttachments(id),
                  uploadUrl: (input) => living.ticket.attachmentUploadUrl(id, input),
                  add: (input) => living.ticket.addAttachment(id, input),
                  remove: (attachmentId) => living.ticket.removeAttachment(id, attachmentId),
                }}
              />
            </Section>
            <Section title={data.status === 'IN_PROGRESS' ? 'After photos — required to resolve' : 'After photos'}>
              <PhotoPanel
                queryKey={['job', 'ticket', id, 'attachments']}
                canAdd={has(perms, 'ticket:update')}
                stage="AFTER"
                api={{
                  list: () => living.ticket.listAttachments(id),
                  uploadUrl: (input) => living.ticket.attachmentUploadUrl(id, input),
                  add: (input) => living.ticket.addAttachment(id, input),
                  remove: (attachmentId) => living.ticket.removeAttachment(id, attachmentId),
                }}
              />
            </Section>
          </>
        )}

        {/* Service-request feedback (display only) */}
        {kind === 'service-request' && data.status === 'COMPLETED' && <ServiceFeedback id={id} />}

        {/* Timeline (WO + ticket; SR has no timeline endpoint) */}
        {kind !== 'service-request' && (
          <Section title="Timeline">
            <TimelinePanel
              queryKey={['job', kind, id, 'timeline']}
              load={() => (kind === 'work-order' ? living.workOrder.timeline(id) : living.ticket.timeline(id))}
            />
          </Section>
        )}
      </div>
    </div>
  );
}

/** A titled block inside the detail body. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wider text-subtle">{title}</h2>
      {children}
    </section>
  );
}

/** Resident's rating on a completed service request — read-only for the worker. */
function ServiceFeedback({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ['job', 'service-request', id, 'feedback'],
    queryFn: () => living.serviceRequest.getFeedback(id),
  });
  return (
    <Card variant="elevated" className="flex items-center gap-3">
      <Star className="h-5 w-5 shrink-0 text-[var(--warning)]" />
      {q.isLoading ? (
        <span className="text-sm text-subtle">Loading feedback…</span>
      ) : !q.data ? (
        <span className="text-sm text-subtle">No resident feedback yet.</span>
      ) : (
        <div>
          <p className="text-sm font-medium text-strong">{q.data.rating}/5 from the resident</p>
          {q.data.comment && <p className="text-xs text-muted">“{q.data.comment}”</p>}
        </div>
      )}
    </Card>
  );
}
