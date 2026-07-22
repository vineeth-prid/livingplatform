/**
 * Central query-key factory. Every hook derives keys from here so cache
 * invalidation stays consistent across the app (and future feature sprints).
 */
export const qk = {
  session: ['session'] as const,
  communities: (params?: unknown) => ['communities', params ?? {}] as const,
  community: (id: string) => ['community', id] as const,
  units: (communityId: string, params?: unknown) => ['units', communityId, params ?? {}] as const,
  tickets: (communityId: string, params?: unknown) => ['tickets', communityId, params ?? {}] as const,
  ticket: (id: string) => ['ticket', id] as const,
  ticketDashboard: (communityId: string) => ['ticket-dashboard', communityId] as const,
  serviceRequests: (communityId: string, params?: unknown) => ['service-requests', communityId, params ?? {}] as const,
  workOrders: (communityId: string, params?: unknown) => ['work-orders', communityId, params ?? {}] as const,
  residents: (communityId: string, params?: unknown) => ['residents', communityId, params ?? {}] as const,
  vendors: (params?: unknown) => ['vendors', params ?? {}] as const,
  staff: (communityId: string, params?: unknown) => ['staff', communityId, params ?? {}] as const,
} as const;
