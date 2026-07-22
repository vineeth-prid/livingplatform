import { useQueries } from '@tanstack/react-query';
import { useAuth } from '@living/hooks';
import type { ServiceRequest, Ticket } from '@living/types';

import { useResidentCommunity } from './community';
import { living } from './lib/living';

export type RequestKind = 'ticket' | 'service';

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

/**
 * The resident's own tickets + service requests, merged and newest-first.
 * No "reported by me" filter exists on the list APIs, so we fetch the recent
 * window and keep only items this user raised (reportedById / requestedById).
 */
export function useMyRequests() {
  const { session } = useAuth();
  const { communityId } = useResidentCommunity();
  const uid = session?.user.id;
  const enabled = !!communityId && !!uid;

  const [tickets, services] = useQueries({
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
    ],
  });

  const mineT = (tickets.data?.items ?? []).filter((t: Ticket) => t.reportedById === uid);
  const mineS = (services.data?.items ?? []).filter((s: ServiceRequest) => s.requestedById === uid);

  const items: MyRequest[] = [
    ...mineT.map((t) => ({
      kind: 'ticket' as const, id: t.id, number: t.ticketNumber, title: t.title,
      status: t.status, priority: t.priority, createdAt: t.createdAt, detailPath: `/requests/ticket/${t.id}`,
    })),
    ...mineS.map((s) => ({
      kind: 'service' as const, id: s.id, number: s.requestNumber, title: s.title,
      status: s.status, priority: s.priority, createdAt: s.createdAt, detailPath: `/requests/service/${s.id}`,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const open = items.filter((r) =>
    r.kind === 'ticket' ? ACTIVE_TICKET.has(r.status) : ACTIVE_SERVICE.has(r.status),
  );

  return {
    items,
    open,
    isLoading: enabled && (tickets.isLoading || services.isLoading),
    isError: tickets.isError || services.isError,
    refetch: () => { void tickets.refetch(); void services.refetch(); },
  };
}
