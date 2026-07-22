import type {
  Resident, ServiceRequest, Ticket, TicketDashboardSummary, WorkOrder,
} from '@living/types';

/**
 * Pure derivations for the dashboard. All display logic lives here (not in
 * components) so it stays testable and free of React/SDK. Inputs are the raw
 * SDK payloads; outputs are the exact numbers/lists the sections render.
 *
 * Counts sourced from the ticket dashboard summary are exact (backend groupBy).
 * Service-request / work-order counts are derived from a recent operational
 * window (the newest ~100 items) — honest "current operations", not all-time BI.
 * ponytail: no SR/WO summary endpoint exists; a window is the lean, correct-for-
 * purpose source without touching the backend. Add summary endpoints if a
 * community's active volume ever exceeds the window.
 */

const SR_TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'REJECTED']);
const WO_DONE = new Set(['COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED']);
const TICKET_ACTIVE = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD']);

export function startOfDay(d: Date = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function isSameDay(iso: string | null | undefined, dayStart: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= dayStart && t < dayStart + 86_400_000;
}

// ── Section 2 — Today's Operations (KPIs) ────────────────────────────────────

export interface DashboardKpis {
  openTickets: number;
  criticalTickets: number;
  openServiceRequests: number;
  pendingWorkOrders: number;
  pendingVerification: number;
  overdueWorkOrders: number;
  scheduledToday: number;
  resolvedToday: number;
}

export function computeKpis(input: {
  summary?: TicketDashboardSummary;
  serviceRequests: ServiceRequest[];
  workOrders: WorkOrder[];
  now?: number;
}): DashboardKpis {
  const now = input.now ?? Date.now();
  const today = startOfDay(new Date(now));
  const s = input.summary;

  const openServiceRequests = input.serviceRequests.filter((r) => !SR_TERMINAL.has(r.status)).length;
  const pendingWorkOrders = input.workOrders.filter((w) => !WO_DONE.has(w.status)).length;
  const pendingVerification = input.workOrders.filter((w) => w.status === 'COMPLETED').length;
  const overdueWorkOrders = input.workOrders.filter(
    (w) => !WO_DONE.has(w.status) && w.dueDate != null && new Date(w.dueDate).getTime() < now,
  ).length;
  const scheduledToday =
    input.serviceRequests.filter((r) => !SR_TERMINAL.has(r.status) && isSameDay(r.preferredDate, today)).length +
    input.workOrders.filter((w) => !WO_DONE.has(w.status) && isSameDay(w.dueDate, today)).length;

  return {
    openTickets: s ? s.open + s.assigned + s.inProgress + s.onHold : 0,
    criticalTickets: s?.criticalOpen ?? 0,
    openServiceRequests,
    pendingWorkOrders,
    pendingVerification,
    overdueWorkOrders,
    scheduledToday,
    resolvedToday: s?.resolvedToday ?? 0,
  };
}

// ── Section 3 — Attention Required ───────────────────────────────────────────

export type AttentionTone = 'danger' | 'warning' | 'info';
export interface AttentionGroup {
  id: string;
  label: string;
  count: number;
  tone: AttentionTone;
  href: string;
  sample?: string;
}

export function buildAttention(input: {
  tickets: Ticket[];
  serviceRequests: ServiceRequest[];
  workOrders: WorkOrder[];
  now?: number;
}): AttentionGroup[] {
  const now = input.now ?? Date.now();
  const criticalTickets = input.tickets.filter(
    (t) => TICKET_ACTIVE.has(t.status) && (t.priority === 'CRITICAL' || t.priority === 'HIGH'),
  );
  const unassignedTickets = input.tickets.filter(
    (t) => t.status === 'OPEN' && !t.assignedStaffId && !t.assignedVendorId,
  );
  const pendingVerification = input.workOrders.filter((w) => w.status === 'COMPLETED');
  const overdue = input.workOrders.filter(
    (w) => !WO_DONE.has(w.status) && w.dueDate != null && new Date(w.dueDate).getTime() < now,
  );
  const rejected = input.serviceRequests.filter((r) => r.status === 'REJECTED');

  const groups: AttentionGroup[] = [
    {
      id: 'critical', label: 'High-priority tickets', tone: 'danger', href: '/tickets',
      count: criticalTickets.length, sample: criticalTickets[0]?.title,
    },
    {
      id: 'overdue', label: 'Overdue work orders', tone: 'danger', href: '/work-orders',
      count: overdue.length, sample: overdue[0]?.title,
    },
    {
      id: 'verify', label: 'Awaiting verification', tone: 'warning', href: '/work-orders',
      count: pendingVerification.length, sample: pendingVerification[0]?.title,
    },
    {
      id: 'unassigned', label: 'Awaiting assignment', tone: 'warning', href: '/tickets',
      count: unassignedTickets.length, sample: unassignedTickets[0]?.title,
    },
    {
      id: 'rejected', label: 'Rejected service requests', tone: 'info', href: '/service-requests',
      count: rejected.length, sample: rejected[0]?.title,
    },
  ];
  return groups.filter((g) => g.count > 0);
}

// ── Section 4 — Recent Activity ──────────────────────────────────────────────

export type ActivityKind =
  | 'ticket-created' | 'ticket-resolved' | 'service-created' | 'service-assigned'
  | 'service-completed' | 'work-completed' | 'work-verified' | 'resident-registered';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  title: string;
  meta?: string;
  at: string; // ISO
  href: string;
}

/** Pick the single most-significant recent event per item (using the timestamps
 *  the list payloads already carry) — no timeline endpoint needed. */
export function buildActivity(input: {
  tickets: Ticket[];
  serviceRequests: ServiceRequest[];
  workOrders: WorkOrder[];
  residents: Resident[];
  limit?: number;
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const t of input.tickets) {
    if (t.resolvedDate) {
      events.push({ id: `t-r-${t.id}`, kind: 'ticket-resolved', title: `${t.ticketNumber} resolved`, meta: t.title, at: t.resolvedDate, href: '/tickets' });
    } else {
      events.push({ id: `t-c-${t.id}`, kind: 'ticket-created', title: `${t.ticketNumber} raised`, meta: t.title, at: t.createdAt, href: '/tickets' });
    }
  }
  for (const r of input.serviceRequests) {
    if (r.completedDate) {
      events.push({ id: `s-x-${r.id}`, kind: 'service-completed', title: `${r.requestNumber} completed`, meta: r.title, at: r.completedDate, href: '/service-requests' });
    } else if (r.assignedStaffId || r.assignedVendorId) {
      events.push({ id: `s-a-${r.id}`, kind: 'service-assigned', title: `${r.requestNumber} assigned`, meta: r.title, at: r.updatedAt, href: '/service-requests' });
    } else {
      events.push({ id: `s-c-${r.id}`, kind: 'service-created', title: `${r.requestNumber} requested`, meta: r.title, at: r.createdAt, href: '/service-requests' });
    }
  }
  for (const w of input.workOrders) {
    if (w.verifiedDate) {
      events.push({ id: `w-v-${w.id}`, kind: 'work-verified', title: `${w.workOrderNumber} verified`, meta: w.title, at: w.verifiedDate, href: '/work-orders' });
    } else if (w.completedDate) {
      events.push({ id: `w-x-${w.id}`, kind: 'work-completed', title: `${w.workOrderNumber} completed`, meta: w.title, at: w.completedDate, href: '/work-orders' });
    }
  }
  for (const person of input.residents) {
    events.push({ id: `r-${person.id}`, kind: 'resident-registered', title: `${person.firstName} ${person.lastName} registered`, meta: person.residentCode, at: person.createdAt, href: '/residents' });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events.slice(0, input.limit ?? 12);
}

export interface ActivityBuckets {
  today: ActivityEvent[];
  yesterday: ActivityEvent[];
  earlier: ActivityEvent[];
}

export function groupActivity(events: ActivityEvent[], now: number = Date.now()): ActivityBuckets {
  const today = startOfDay(new Date(now));
  const yesterday = today - 86_400_000;
  const buckets: ActivityBuckets = { today: [], yesterday: [], earlier: [] };
  for (const e of events) {
    const t = new Date(e.at).getTime();
    if (t >= today) buckets.today.push(e);
    else if (t >= yesterday) buckets.yesterday.push(e);
    else buckets.earlier.push(e);
  }
  return buckets;
}

// ── Section 5 — Community Health ─────────────────────────────────────────────

export interface HealthIndicators {
  openTickets: number;
  closedTickets: number;
  ticketClosureRate: number; // 0..1
  serviceCompletionRate: number; // 0..1
  pendingVerification: number;
  occupancyRate: number | null; // 0..1, null when unknown
}

export function computeHealth(input: {
  summary?: TicketDashboardSummary;
  serviceRequests: ServiceRequest[];
  workOrders: WorkOrder[];
  totalUnits?: number;
  occupiedUnits?: number;
}): HealthIndicators {
  const byStatus = input.summary?.byStatus ?? [];
  const count = (status: string) => byStatus.find((b) => b.status === status)?.count ?? 0;
  const open = count('OPEN') + count('ASSIGNED') + count('IN_PROGRESS') + count('ON_HOLD');
  const closed = count('RESOLVED') + count('CLOSED');
  const totalTickets = open + closed;

  const srCompleted = input.serviceRequests.filter((r) => r.status === 'COMPLETED').length;
  const srConsidered = input.serviceRequests.filter((r) => r.status !== 'CANCELLED' && r.status !== 'REJECTED').length;

  return {
    openTickets: open,
    closedTickets: closed,
    ticketClosureRate: totalTickets > 0 ? closed / totalTickets : 0,
    serviceCompletionRate: srConsidered > 0 ? srCompleted / srConsidered : 0,
    pendingVerification: input.workOrders.filter((w) => w.status === 'COMPLETED').length,
    occupancyRate:
      input.totalUnits && input.totalUnits > 0 && input.occupiedUnits != null
        ? input.occupiedUnits / input.totalUnits
        : null,
  };
}

// ── Section 6 — My Work ──────────────────────────────────────────────────────

export interface MyWork {
  raisedTickets: Ticket[];
  requestedServices: ServiceRequest[];
  awaitingMyVerification: WorkOrder[];
}

/** Items the signed-in user owns or must act on. Assignment is by staff/vendor
 *  profile id (not resolvable client-side without a lookup), so "mine" = items
 *  I reported + (for verifiers) work awaiting verification. */
export function buildMyWork(input: {
  userId: string;
  canVerify: boolean;
  tickets: Ticket[];
  serviceRequests: ServiceRequest[];
  workOrders: WorkOrder[];
}): MyWork {
  return {
    raisedTickets: input.tickets
      .filter((t) => t.reportedById === input.userId && TICKET_ACTIVE.has(t.status))
      .slice(0, 5),
    requestedServices: input.serviceRequests
      .filter((r) => r.requestedById === input.userId && !SR_TERMINAL.has(r.status))
      .slice(0, 5),
    awaitingMyVerification: input.canVerify
      ? input.workOrders.filter((w) => w.status === 'COMPLETED').slice(0, 5)
      : [],
  };
}
