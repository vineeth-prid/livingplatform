import { describe, expect, it } from 'vitest';
import type { ServiceRequest, Ticket, TicketDashboardSummary, WorkOrder } from '@living/types';

import {
  buildActivity, buildAttention, buildMyWork, computeHealth, computeKpis, groupActivity,
} from './derive';

const NOW = new Date('2026-07-21T10:00:00.000Z').getTime();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const summary: TicketDashboardSummary = {
  open: 5, assigned: 3, inProgress: 2, onHold: 1, resolvedToday: 4, closedToday: 2, criticalOpen: 2,
  byStatus: [
    { status: 'OPEN', count: 5 }, { status: 'ASSIGNED', count: 3 },
    { status: 'IN_PROGRESS', count: 2 }, { status: 'ON_HOLD', count: 1 },
    { status: 'RESOLVED', count: 4 }, { status: 'CLOSED', count: 6 },
  ],
  byPriority: [], byCategory: [],
};

const wo = (over: Partial<WorkOrder>): WorkOrder =>
  ({ id: 'w', number: 1, workOrderNumber: 'WO-000001', communityId: 'c', title: 'Fix',
     description: '', priority: 'MEDIUM', status: 'ASSIGNED', reassignedCount: 0,
     originType: 'MANUAL', createdAt: iso(0), updatedAt: iso(0), ...over }) as WorkOrder;

const sr = (over: Partial<ServiceRequest>): ServiceRequest =>
  ({ id: 's', number: 1, requestNumber: 'SRQ-000001', communityId: 'c', unitId: 'u', serviceId: 'sv',
     title: 'Clean', description: '', priority: 'MEDIUM', status: 'REQUESTED', requestedById: 'me',
     createdAt: iso(0), updatedAt: iso(0), ...over }) as ServiceRequest;

const tk = (over: Partial<Ticket>): Ticket =>
  ({ id: 't', number: 1, ticketNumber: 'TKT-000001', communityId: 'c', unitId: 'u', categoryId: 'cat',
     title: 'Leak', description: '', priority: 'MEDIUM', status: 'OPEN', source: 'ADMIN_PORTAL',
     reportedById: 'me', reassignedCount: 0, createdAt: iso(0), updatedAt: iso(0), ...over }) as Ticket;

describe('computeKpis', () => {
  it('sums active tickets from the summary and derives SR/WO counts', () => {
    const k = computeKpis({
      summary,
      serviceRequests: [sr({}), sr({ status: 'COMPLETED' }), sr({ status: 'IN_PROGRESS' })],
      workOrders: [
        wo({ status: 'ASSIGNED' }),
        wo({ status: 'COMPLETED' }),
        wo({ status: 'IN_PROGRESS', dueDate: iso(-86_400_000) }), // overdue
        wo({ status: 'CLOSED' }),
      ],
      now: NOW,
    });
    expect(k.openTickets).toBe(11); // 5+3+2+1
    expect(k.criticalTickets).toBe(2);
    expect(k.openServiceRequests).toBe(2); // excludes COMPLETED
    expect(k.pendingWorkOrders).toBe(2); // ASSIGNED + IN_PROGRESS (excludes COMPLETED & CLOSED)
    expect(k.pendingVerification).toBe(1);
    expect(k.overdueWorkOrders).toBe(1);
    expect(k.resolvedToday).toBe(4);
  });

  it('does not count a completed work order as overdue even if past due', () => {
    const k = computeKpis({
      summary,
      serviceRequests: [],
      workOrders: [wo({ status: 'COMPLETED', dueDate: iso(-86_400_000) })],
      now: NOW,
    });
    expect(k.overdueWorkOrders).toBe(0);
  });
});

describe('buildAttention', () => {
  it('surfaces only non-empty urgency groups, danger first', () => {
    const groups = buildAttention({
      tickets: [tk({ priority: 'CRITICAL', status: 'IN_PROGRESS', title: 'Burst pipe' })],
      serviceRequests: [sr({ status: 'REJECTED' })],
      workOrders: [wo({ status: 'COMPLETED' })],
      now: NOW,
    });
    const ids = groups.map((g) => g.id);
    expect(ids).toContain('critical');
    expect(ids).toContain('verify');
    expect(ids).toContain('rejected');
    expect(groups.every((g) => g.count > 0)).toBe(true);
    expect(groups[0]?.tone).toBe('danger');
  });
});

describe('buildActivity / groupActivity', () => {
  it('picks the most significant event and buckets by day, newest first', () => {
    const events = buildActivity({
      tickets: [tk({ resolvedDate: iso(-1000), ticketNumber: 'TKT-000009' })],
      serviceRequests: [sr({ createdAt: iso(-90_000_000) })], // ~yesterday+
      workOrders: [wo({ status: 'VERIFIED', verifiedDate: iso(-500) })],
      residents: [],
    });
    expect(events[0]?.at).toBe(iso(-500)); // newest
    const buckets = groupActivity(events, NOW);
    expect(buckets.today.length).toBe(2);
    expect(buckets.today.concat(buckets.yesterday, buckets.earlier).length).toBe(events.length);
  });
});

describe('computeHealth', () => {
  it('computes closure/completion/occupancy rates', () => {
    const h = computeHealth({
      summary,
      serviceRequests: [sr({ status: 'COMPLETED' }), sr({ status: 'IN_PROGRESS' })],
      workOrders: [wo({ status: 'COMPLETED' })],
      totalUnits: 200, occupiedUnits: 150,
    });
    expect(h.openTickets).toBe(11);
    expect(h.closedTickets).toBe(10); // RESOLVED 4 + CLOSED 6
    expect(h.serviceCompletionRate).toBeCloseTo(0.5);
    expect(h.occupancyRate).toBeCloseTo(0.75);
  });

  it('returns null occupancy when units are unknown', () => {
    const h = computeHealth({ summary, serviceRequests: [], workOrders: [] });
    expect(h.occupancyRate).toBeNull();
  });
});

describe('buildMyWork', () => {
  it('returns items I reported and (for verifiers) work awaiting verification', () => {
    const mine = buildMyWork({
      userId: 'me',
      canVerify: true,
      tickets: [tk({ reportedById: 'me' }), tk({ reportedById: 'other' })],
      serviceRequests: [sr({ requestedById: 'me' })],
      workOrders: [wo({ status: 'COMPLETED' })],
    });
    expect(mine.raisedTickets.length).toBe(1);
    expect(mine.requestedServices.length).toBe(1);
    expect(mine.awaitingMyVerification.length).toBe(1);
  });

  it('hides verification work when the user cannot verify', () => {
    const mine = buildMyWork({
      userId: 'me', canVerify: false, tickets: [], serviceRequests: [],
      workOrders: [wo({ status: 'COMPLETED' })],
    });
    expect(mine.awaitingMyVerification.length).toBe(0);
  });
});
