import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceRequest, Ticket, WorkOrder } from '@living/types';

import { isActive, type JobKind } from './execution';
import { living } from './lib/living';
import { useWorker } from './worker';

/** One normalized job across the three engines — the field worker's unit of work. */
export interface Job {
  kind: JobKind;
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  unitLabel: string | null;
  /** Scheduled/target day: WO & ticket dueDate, SR preferredDate. */
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  detailPath: string;
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };

function toJob(kind: JobKind, raw: WorkOrder | ServiceRequest | Ticket): Job {
  const common = {
    kind, id: raw.id, title: raw.title, status: raw.status, priority: raw.priority,
    unitLabel: raw.unit?.unitNumber ?? null, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
    active: isActive(kind, raw.status), detailPath: `/jobs/${kind}/${raw.id}`,
  };
  if (kind === 'work-order') {
    const wo = raw as WorkOrder;
    return { ...common, number: wo.workOrderNumber, targetDate: wo.dueDate ?? null };
  }
  if (kind === 'service-request') {
    const sr = raw as ServiceRequest;
    return { ...common, number: sr.requestNumber, targetDate: sr.preferredDate ?? null };
  }
  const t = raw as Ticket;
  return { ...common, number: t.ticketNumber, targetDate: t.dueDate ?? null };
}

/**
 * Every job assigned to this worker across work orders, service requests and
 * tickets — merged, then bucketed for the Today screen. No "assigned to me"
 * filter exists on the list APIs, so we pull the recent window per engine and
 * keep only rows assigned to our staff/vendor id (same approach as the resident
 * app's "my requests").
 *
 * ponytail: recent-100 window per engine, client-side filter. If a worker ever
 * carries >100 open jobs, add server-side `assignedToMe` + pagination.
 */
export function useMyJobs() {
  const { communityId, staffId, vendorId, isLinked } = useWorker();
  const enabled = !!communityId && isLinked;
  const params = { limit: 100, sortBy: 'createdAt', sortDir: 'desc' as const };

  const [woQ, srQ, tkQ] = useQueries({
    queries: [
      { queryKey: ['jobs', 'work-order', communityId], queryFn: () => living.workOrder.list(communityId!, params), enabled },
      { queryKey: ['jobs', 'service-request', communityId], queryFn: () => living.serviceRequest.list(communityId!, params), enabled },
      { queryKey: ['jobs', 'ticket', communityId], queryFn: () => living.ticket.list(communityId!, params), enabled },
    ],
  });

  const mine = (o: { assignedStaffId?: string | null; assignedVendorId?: string | null }) =>
    (!!staffId && o.assignedStaffId === staffId) || (!!vendorId && o.assignedVendorId === vendorId);

  const all = useMemo<Job[]>(() => {
    const jobs = [
      ...(woQ.data?.items ?? []).filter(mine).map((w) => toJob('work-order', w)),
      ...(srQ.data?.items ?? []).filter(mine).map((s) => toJob('service-request', s)),
      ...(tkQ.data?.items ?? []).filter(mine).map((t) => toJob('ticket', t)),
    ];
    return jobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [woQ.data, srQ.data, tkQ.data, staffId, vendorId]);

  const buckets = useMemo(() => {
    const dayStart = startOfToday();
    const dayEnd = endOfToday();
    const active = all.filter((j) => j.active);
    const dueMs = (j: Job) => (j.targetDate ? new Date(j.targetDate).getTime() : null);
    return {
      active,
      inProgress: active.filter((j) => j.status === 'IN_PROGRESS'),
      overdue: active.filter((j) => { const d = dueMs(j); return d != null && d < dayStart; }),
      today: active.filter((j) => {
        const d = dueMs(j);
        return (d != null && d >= dayStart && d <= dayEnd) || (d == null && j.status === 'IN_PROGRESS');
      }),
      upcoming: active.filter((j) => { const d = dueMs(j); return d != null && d > dayEnd; }),
      priority: active.filter((j) => j.priority === 'HIGH' || j.priority === 'CRITICAL'),
      done: all.filter((j) => !j.active),
    };
  }, [all]);

  return {
    all,
    ...buckets,
    isLoading: enabled && (woQ.isLoading || srQ.isLoading || tkQ.isLoading),
    isError: woQ.isError || srQ.isError || tkQ.isError,
    refetch: () => { void woQ.refetch(); void srQ.refetch(); void tkQ.refetch(); },
  };
}

// ── Job detail + execution mutations (shared by the detail screen) ────────────

const detailKey = (kind: JobKind, id: string) => ['job', kind, id] as const;

export function useJob(kind: JobKind, id: string) {
  return useQuery({
    queryKey: detailKey(kind, id),
    queryFn: (): Promise<WorkOrder | ServiceRequest | Ticket> =>
      kind === 'work-order' ? living.workOrder.get(id)
        : kind === 'service-request' ? living.serviceRequest.get(id)
        : living.ticket.get(id),
  });
}

type JobEntity = WorkOrder | ServiceRequest | Ticket;

/** Optimistic status change routed to the right engine. */
export function useJobStatus(kind: JobKind, id: string) {
  const qc = useQueryClient();
  const key = detailKey(kind, id);
  return useMutation<JobEntity, Error, string, { previous: JobEntity | undefined }>({
    mutationFn: (status: string): Promise<JobEntity> =>
      kind === 'work-order' ? living.workOrder.changeStatus(id, status)
        : kind === 'service-request' ? living.serviceRequest.changeStatus(id, status)
        : living.ticket.changeStatus(id, status),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<JobEntity>(key);
      if (previous) qc.setQueryData<JobEntity>(key, { ...previous, status } as JobEntity);
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(key, ctx.previous); },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
