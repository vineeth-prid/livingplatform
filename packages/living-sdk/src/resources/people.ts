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
  createResident(communityId: string, input: Body): Promise<Resident> {
    return this.http.post(`/communities/${communityId}/residents`, input);
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
