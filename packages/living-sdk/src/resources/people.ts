import type { ListParams, Paginated, Resident, Staff, Vendor } from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/** People Foundation: residents (+ unit assignment), vendors, staff. */
export class PeopleResource {
  constructor(private readonly http: HttpClient) {}

  // ── Residents (community-scoped) ──
  listResidents(communityId: string, params?: Query): Promise<Paginated<Resident>> {
    return this.http.get(`/communities/${communityId}/residents`, params);
  }

  /**
   * The signed-in resident's OWN record(s) + household. Needs no `resident:read`,
   * which is exactly why it exists — a resident must be able to find their own
   * residentId and unit to invite visitors, book amenities or raise a request.
   */
  myResident(): Promise<{
    residents: Resident[];
    family: Resident[];
    /**
     * Units this person is financially responsible for. Empty for a tenant,
     * which is what tells the app not to offer Maintenance — the API refuses
     * them either way, this only avoids a door onto an empty room.
     */
    ownedUnits: OwnedUnit[];
  }> {
    return this.http.get('/residents/me');
  }

  // ── Unit ownership (admin) ──
  /** Owners on record for a unit, with ownership and account status. */
  listUnitOwners(communityId: string, unitId: string): Promise<UnitOwner[]> {
    return this.http.get(`/communities/${communityId}/units/${unitId}/owners`);
  }
  /** Record an owner: link an existing resident, or create one with a login. */
  addUnitOwner(communityId: string, unitId: string, input: Body): Promise<unknown> {
    return this.http.post(`/communities/${communityId}/units/${unitId}/owners`, input);
  }
  updateUnitOwner(
    communityId: string,
    unitId: string,
    residentId: string,
    input: Body,
  ): Promise<unknown> {
    return this.http.patch(
      `/communities/${communityId}/units/${unitId}/owners/${residentId}`,
      input,
    );
  }
  /** End an ownership — kept as history, never deleted. */
  endUnitOwner(communityId: string, unitId: string, residentId: string): Promise<unknown> {
    return this.http.delete(`/communities/${communityId}/units/${unitId}/owners/${residentId}`);
  }
  /** Units with nobody recorded as owner — the migration's worklist. */
  ownershipGaps(communityId: string, limit?: number): Promise<OwnershipGapReport> {
    return this.http.get(`/communities/${communityId}/units/ownership-gaps`, { limit });
  }
  addFamilyMember(input: {
    firstName: string;
    lastName?: string;
    mobile: string;
    email?: string;
  }): Promise<Resident> {
    return this.http.post('/residents/me/family', input);
  }
  removeFamilyMember(id: string): Promise<unknown> {
    return this.http.delete(`/residents/me/family/${id}`);
  }
  createResident(communityId: string, input: Body): Promise<Resident> {
    return this.http.post(`/communities/${communityId}/residents`, input);
  }
  bulkCreateResidents(
    communityId: string,
    rows: Body[],
  ): Promise<{ created: number; failed: number; errors: { row: number; mobile: string; error: string }[] }> {
    return this.http.post(`/communities/${communityId}/residents/bulk`, { rows });
  }
  getResident(id: string): Promise<Resident> {
    return this.http.get(`/residents/${id}`);
  }
  updateResident(id: string, input: Body): Promise<Resident> {
    return this.http.patch(`/residents/${id}`, input);
  }
  deleteResident(id: string): Promise<unknown> {
    return this.http.delete(`/residents/${id}`);
  }
  assignResidentUnit(id: string, input: Body): Promise<unknown> {
    return this.http.put(`/residents/${id}/unit`, input);
  }
  unassignResidentUnit(id: string): Promise<unknown> {
    return this.http.delete(`/residents/${id}/unit`);
  }

  // ── Vendors (tenant-scoped) ──
  listVendors(params?: Query): Promise<Paginated<Vendor>> {
    return this.http.get('/vendors', params);
  }

  /**
   * The signed-in vendor's OWN record(s). Needs no `vendor:read` — which is why
   * it exists: a vendor holds none, so scanning the vendor list to find
   * themselves 403s and leaves the Workforce app unable to identify them.
   */
  myVendor(): Promise<{ items: Vendor[] }> {
    return this.http.get('/vendors/me');
  }
  /**
   * Create the login for a staff member or vendor who has none.
   *
   * Provisioning links an account to the FIRST profile on a phone number, so
   * a later one is created unlinked and cannot sign in at all.
   */
  createStaffLogin(id: string): Promise<{ userId: string; username: string; temporaryPassword: string }> {
    return this.http.post(`/staff/${id}/login`, {});
  }
  createVendorLogin(id: string): Promise<{ userId: string; username: string; temporaryPassword: string }> {
    return this.http.post(`/vendors/${id}/login`, {});
  }
  createVendor(input: Body): Promise<Vendor> {
    return this.http.post('/vendors', input);
  }
  getVendor(id: string): Promise<Vendor> {
    return this.http.get(`/vendors/${id}`);
  }
  updateVendor(id: string, input: Body): Promise<Vendor> {
    return this.http.patch(`/vendors/${id}`, input);
  }
  deleteVendor(id: string): Promise<unknown> {
    return this.http.delete(`/vendors/${id}`);
  }

  // ── Staff (community-scoped) ──

  /**
   * The signed-in staff member's OWN record(s). Needs no `staff:read` — the
   * STAFF role holds none, so scanning the community's staff list to find
   * themselves 403s and the Workforce app cannot identify them.
   */
  myStaff(): Promise<{ items: Staff[] }> {
    return this.http.get('/staff/me');
  }

  listStaff(communityId: string, params?: Query): Promise<Paginated<Staff>> {
    return this.http.get(`/communities/${communityId}/staff`, params);
  }
  createStaff(communityId: string, input: Body): Promise<Staff> {
    return this.http.post(`/communities/${communityId}/staff`, input);
  }
  getStaff(id: string): Promise<Staff> {
    return this.http.get(`/staff/${id}`);
  }
  updateStaff(id: string, input: Body): Promise<Staff> {
    return this.http.patch(`/staff/${id}`, input);
  }
  deleteStaff(id: string): Promise<unknown> {
    return this.http.delete(`/staff/${id}`);
  }
}

/** A unit this person is financially responsible for. */
export interface OwnedUnit {
  unitId: string;
  communityId: string;
  unitNumber: string;
  blockName: string | null;
  isPrimaryOwner: boolean;
}

/**
 * An owner on record for a unit.
 *
 * `accountStatus` is deliberately separate from ownership: someone can own a
 * flat for years without ever opening the app, and NOT_REGISTERED says exactly
 * that rather than implying something is wrong.
 */
export interface UnitOwner {
  id: string;
  residentId: string;
  isPrimary: boolean;
  sharePercent: number | null;
  startDate: string | null;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string | null;
  residentStatus: string;
  accountStatus: 'NOT_REGISTERED' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

/** Units with no owner recorded — what the migration deliberately did not guess. */
export interface OwnershipGapReport {
  total: number;
  limit: number;
  units: {
    unitId: string;
    unitNumber: string;
    declaredOwnership: string;
    ownerNameOnUnit: string | null;
    ownerPhoneOnUnit: string | null;
    occupants: { residentId: string; name: string; mobile: string; role: string }[];
    /** A hint for the admin to confirm. Never applied automatically. */
    suggestion: string | null;
  }[];
}
