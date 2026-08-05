import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useAuth } from '@living/hooks';
import type { ServiceRequest, Ticket } from '@living/types';

import { useResidentCommunity } from './community';
import { useMyResident } from './community-ops';
import { living } from './lib/living';

export type RequestKind = 'ticket' | 'service' | 'visitor' | 'work-order';

export interface MyRequest {
  kind: RequestKind;
  id: string;
  number: string;
  title: string;
  status: string;
  priority?: string;
  createdAt: string;
  detailPath: string;
}

const ACTIVE_TICKET = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD']);
const ACTIVE_SERVICE = new Set(['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS']);
const ACTIVE_WORK_ORDER = new Set([
  'PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
]);

/** "WO-000123" — the API returns the raw sequence, not the display number. */
function formatWorkOrderNumber(workOrder: { number?: number; id: string }): string {
  return workOrder.number != null
    ? `WO-${String(workOrder.number).padStart(6, '0')}`
    : workOrder.id.slice(0, 8).toUpperCase();
}

/**
 * The resident's own tickets + service requests, merged and newest-first.
 * No "reported by me" filter exists on the list APIs, so we fetch the recent
 * window and keep only items this user raised (reportedById / requestedById).
 */
export function useMyRequests() {
  const { session } = useAuth();
  const { communityId } = useResidentCommunity();
  const { residents } = useMyResident();
  const uid = session?.user.id;
  const enabled = !!communityId && !!uid;
  const residentIds = useMemo(() => new Set(residents.map((r) => r.id)), [residents]);

  const [tickets, services, workOrders] = useQueries({
    queries: [
      {
        queryKey: ['my', 'tickets', communityId],
        queryFn: () => living.ticket.list(communityId!, { limit: 100, sortBy: 'createdAt', sortDir: 'desc' }),
        enabled,
      },
      {
        queryKey: ['my', 'service-requests', communityId],
        queryFn: () => living.serviceRequest.list(communityId!, { limit: 100, sortBy: 'createdAt', sortDir: 'desc' }),
        enabled,
      },
      {
        // Maintenance raised against this resident's flat. Self-scoped
        // server-side (residents hold no work-order permission), so unlike the
        // two lists above it needs no client-side ownership filter.
        queryKey: ['my', 'work-orders'],
        queryFn: () => living.workOrder.mine({ limit: 50, sortBy: 'createdAt', sortDir: 'desc' }),
        enabled: !!uid,
      },
    ],
  });

  // "Mine" is anything raised BY me or FOR me.
  //
  // Filtering on reportedById/requestedById alone meant a request the community
  // admin raised on a resident's behalf was invisible to that resident — the
  // admin's user id is the one recorded, so it never matched. Matching the
  // resident record as well is what makes an admin-raised request show up in
  // the app of the person it is actually for.
  const mineT = (tickets.data?.items ?? []).filter(
    (t: Ticket) => t.reportedById === uid || (t.residentId && residentIds.has(t.residentId)),
  );
  const mineS = (services.data?.items ?? []).filter(
    (s: ServiceRequest) => s.requestedById === uid || (s.residentId && residentIds.has(s.residentId)),
  );

  const items: MyRequest[] = [
    ...mineT.map((t) => ({
      kind: 'ticket' as const, id: t.id, number: t.ticketNumber, title: t.title,
      status: t.status, priority: t.priority, createdAt: t.createdAt, detailPath: `/requests/ticket/${t.id}`,
    })),
    ...mineS.map((s) => ({
      kind: 'service' as const, id: s.id, number: s.requestNumber, title: s.title,
      status: s.status, priority: s.priority, createdAt: s.createdAt, detailPath: `/requests/service/${s.id}`,
    })),
    // Maintenance on this flat. Read-only for a resident — there is no detail
    // screen to open, so the row links back to the list rather than a dead end.
    ...(workOrders.data?.items ?? []).map((w) => ({
      kind: 'work-order' as const,
      id: w.id,
      number: formatWorkOrderNumber(w),
      title: w.title,
      status: w.status,
      priority: w.priority,
      createdAt: w.createdAt,
      detailPath: '/requests',
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const open = items.filter((r) => {
    if (r.kind === 'ticket') return ACTIVE_TICKET.has(r.status);
    if (r.kind === 'work-order') return ACTIVE_WORK_ORDER.has(r.status);
    return ACTIVE_SERVICE.has(r.status);
  });

  return {
    items,
    open,
    isLoading: enabled && (tickets.isLoading || services.isLoading),
    isError: tickets.isError || services.isError,
    refetch: () => { void tickets.refetch(); void services.refetch(); },
  };
}
