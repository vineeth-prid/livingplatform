import type { ListParams, Paginated } from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;

export type GateEntryType = 'DELIVERY' | 'VISITOR' | 'SERVICE_PERSONNEL' | 'VEHICLE';

export type GateEntryStatus =
  | 'CREATED'
  | 'NOTIFIED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type GateEntryAction =
  | 'CREATED'
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_FAILED'
  | 'VIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NOTE';

export interface GateEntryTimelineRow {
  id: string;
  action: GateEntryAction;
  status: GateEntryStatus | null;
  note: string | null;
  actorId: string | null;
  actorName: string | null;
  channel: string | null;
  createdAt: string;
}

export interface GateEntry {
  id: string;
  communityId: string;
  entryNumber: string;
  entryType: GateEntryType;
  status: GateEntryStatus;
  unitId: string;
  residentId: string | null;
  vendorName: string | null;
  deliveryType: string | null;
  personName: string;
  mobileNumber: string | null;
  vehicleNumber: string | null;
  remarks: string | null;
  photoKey: string | null;
  /** Signed, ready to render. Null when no photo was taken. */
  photoUrl: string | null;
  notifiedAt: string | null;
  viewedAt: string | null;
  decidedAt: string | null;
  decidedById: string | null;
  decisionNote: string | null;
  completedAt: string | null;
  notificationFailed: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  gate?: { id: string; name: string } | null;
  unit?: { id: string; unitNumber: string } | null;
  resident?: {
    id: string;
    firstName: string;
    lastName: string;
    mobile: string;
    userId: string | null;
  } | null;
  timeline?: GateEntryTimelineRow[];
}

export interface CreateGateEntryInput {
  entryType?: GateEntryType;
  unitId: string;
  residentId?: string;
  gateId?: string;
  vendorName?: string;
  deliveryType?: string;
  personName: string;
  mobileNumber?: string;
  vehicleNumber?: string;
  remarks?: string;
  photoKey?: string;
}

export interface GateStatistics {
  today: { total: number; pending: number; approved: number; rejected: number; completed: number };
  pendingApprovals: number;
  averageApprovalSeconds: number | null;
  rejectedInWindow: number;
  topVendors: { vendorName: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  trend: { date: string; count: number }[];
  windowDays: number;
}

export interface Gate {
  id: string;
  communityId: string;
  name: string;
  code: string | null;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Gate Management. Delivery is the first supported entry type; the resource is
 * typed against the generic `GateEntryType` so visitor/vehicle surfaces reuse
 * these methods rather than duplicating them.
 */
export class GateResource {
  constructor(private readonly http: HttpClient) {}

  create(communityId: string, input: CreateGateEntryInput): Promise<GateEntry> {
    return this.http.post('/gate/deliveries', input, { communityId });
  }

  list(communityId: string, params?: Query): Promise<Paginated<GateEntry>> {
    return this.http.get('/gate/deliveries', { communityId, ...params });
  }

  /** The signed-in resident's own entries — needs no gate permission. */
  mine(params?: Query): Promise<Paginated<GateEntry>> {
    return this.http.get('/gate/deliveries/mine', params);
  }

  get(id: string): Promise<GateEntry> {
    return this.http.get(`/gate/deliveries/${id}`);
  }

  update(id: string, input: Partial<CreateGateEntryInput>): Promise<GateEntry> {
    return this.http.patch(`/gate/deliveries/${id}`, input);
  }

  approve(id: string, note?: string): Promise<GateEntry> {
    return this.http.post(`/gate/deliveries/${id}/approve`, { note });
  }

  reject(id: string, note?: string): Promise<GateEntry> {
    return this.http.post(`/gate/deliveries/${id}/reject`, { note });
  }

  /** Record that the resident opened the popup (audit trail only). */
  markViewed(id: string): Promise<{ id: string; viewedAt: string }> {
    return this.http.post(`/gate/deliveries/${id}/viewed`);
  }

  complete(id: string): Promise<GateEntry> {
    return this.http.post(`/gate/deliveries/${id}/complete`);
  }

  cancel(id: string, note?: string): Promise<GateEntry> {
    return this.http.post(`/gate/deliveries/${id}/cancel`, { note });
  }

  statistics(communityId: string, days?: number): Promise<GateStatistics> {
    return this.http.get('/gate/deliveries/statistics', { communityId, days });
  }

  /**
   * Occupants of one unit, name + mobile only. Deliberately not
   * `people.listResidents` — the gate desk holds no `resident:read`.
   */
  unitOccupants(
    communityId: string,
    unitId: string,
  ): Promise<{
    unit: { id: string; unitNumber: string };
    residents: {
      id: string;
      firstName: string;
      lastName: string;
      mobile: string;
      role: string | null;
    }[];
  }> {
    return this.http.get(`/gate/deliveries/units/${unitId}/occupants`, { communityId });
  }

  photoUploadUrl(
    communityId: string,
    input: { fileName: string; contentType?: string },
  ): Promise<{ key: string; uploadUrl: string; expiresAt: string }> {
    return this.http.post('/gate/deliveries/upload-url', input, { communityId });
  }

  // ── Gates ──
  listGates(communityId: string): Promise<Gate[]> {
    return this.http.get(`/communities/${communityId}/gates`);
  }
  createGate(communityId: string, input: { name: string; code?: string }): Promise<Gate> {
    return this.http.post(`/communities/${communityId}/gates`, input);
  }
  updateGate(communityId: string, id: string, input: Partial<Gate>): Promise<Gate> {
    return this.http.patch(`/communities/${communityId}/gates/${id}`, input);
  }
  deleteGate(communityId: string, id: string): Promise<unknown> {
    return this.http.delete(`/communities/${communityId}/gates/${id}`);
  }
}
