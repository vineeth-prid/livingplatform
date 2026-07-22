import { useQueries } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import type {
  Community, Paginated, Resident, ServiceRequest, Ticket,
  TicketDashboardSummary, Unit, WorkOrder,
} from '@living/types';

import { living } from '../../lib/living';

const WINDOW = 100; // recent operational window for SR/WO/tickets
const STALE = 30_000;

/**
 * All dashboard data, fetched in parallel via the SDK and cached by TanStack
 * Query. One hook, `useQueries`, so the whole dashboard has a single loading /
 * error surface and refetches together. No component ever calls fetch.
 */
export function useDashboardData(communityId: string | null) {
  const enabled = !!communityId;
  const cid = communityId ?? '';

  const results = useQueries({
    queries: [
      {
        queryKey: qk.community(cid),
        queryFn: () => living.community.get(cid),
        enabled, staleTime: STALE,
      },
      {
        queryKey: qk.ticketDashboard(cid),
        queryFn: () => living.ticket.dashboard(cid),
        enabled, staleTime: STALE,
      },
      {
        queryKey: qk.tickets(cid, { window: WINDOW }),
        queryFn: () => living.ticket.list(cid, { limit: WINDOW, sortBy: 'createdAt', sortDir: 'desc' }),
        enabled, staleTime: STALE,
      },
      {
        queryKey: qk.serviceRequests(cid, { window: WINDOW }),
        queryFn: () => living.serviceRequest.list(cid, { limit: WINDOW, sortBy: 'createdAt', sortDir: 'desc' }),
        enabled, staleTime: STALE,
      },
      {
        queryKey: qk.workOrders(cid, { window: WINDOW }),
        queryFn: () => living.workOrder.list(cid, { limit: WINDOW, sortBy: 'createdAt', sortDir: 'desc' }),
        enabled, staleTime: STALE,
      },
      {
        queryKey: qk.residents(cid, { window: 15 }),
        queryFn: () => living.people.listResidents(cid, { limit: 15, sortBy: 'createdAt', sortDir: 'desc' }),
        enabled, staleTime: STALE,
      },
      {
        queryKey: qk.units(cid, { status: 'OCCUPIED', count: true }),
        queryFn: () => living.community.listUnits(cid, { status: 'OCCUPIED', limit: 1 }),
        enabled, staleTime: STALE,
      },
    ],
  });

  const [community, summary, tickets, services, workOrders, residents, occupied] = results;

  return {
    isLoading: enabled && results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.isError)?.error,
    refetch: () => results.forEach((r) => void r.refetch()),
    community: (community.data ?? null) as Community | null,
    summary: (summary.data ?? undefined) as TicketDashboardSummary | undefined,
    tickets: (tickets.data as Paginated<Ticket> | undefined)?.items ?? [],
    serviceRequests: (services.data as Paginated<ServiceRequest> | undefined)?.items ?? [],
    workOrders: (workOrders.data as Paginated<WorkOrder> | undefined)?.items ?? [],
    residents: (residents.data as Paginated<Resident> | undefined)?.items ?? [],
    occupiedUnits: (occupied.data as Paginated<Unit> | undefined)?.meta.total ?? 0,
  };
}

export type DashboardData = ReturnType<typeof useDashboardData>;
