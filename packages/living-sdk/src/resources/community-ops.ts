import type {
  Amenity, AmenityBooking, Announcement, CommunityDocument, ListParams, Paginated, Visitor,
} from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/** Visitor management — invite, approve, and run the gate lifecycle. */
export class VisitorsResource {
  constructor(private readonly http: HttpClient) {}

  list(params: { communityId: string } & Query): Promise<Paginated<Visitor>> {
    return this.http.get('/visitors', params);
  }
  get(id: string): Promise<Visitor> {
    return this.http.get(`/visitors/${id}`);
  }
  create(input: Body): Promise<Visitor> {
    return this.http.post('/visitors', input);
  }
  update(id: string, input: Body): Promise<Visitor> {
    return this.http.patch(`/visitors/${id}`, input);
  }
  cancel(id: string): Promise<{ id: string; cancelled: boolean }> {
    return this.http.delete(`/visitors/${id}`);
  }
  approve(id: string): Promise<Visitor> {
    return this.http.post(`/visitors/${id}/approve`, {});
  }
  reject(id: string, reason?: string): Promise<Visitor> {
    return this.http.post(`/visitors/${id}/reject`, { reason });
  }
  checkIn(id: string): Promise<Visitor> {
    return this.http.post(`/visitors/${id}/checkin`, {});
  }
  checkOut(id: string): Promise<Visitor> {
    return this.http.post(`/visitors/${id}/checkout`, {});
  }
}

/** Amenity booking — reserve and cancel amenity slots. */
export class BookingsResource {
  constructor(private readonly http: HttpClient) {}

  list(params: { communityId: string } & Query): Promise<Paginated<AmenityBooking>> {
    return this.http.get('/bookings', params);
  }
  get(id: string): Promise<AmenityBooking> {
    return this.http.get(`/bookings/${id}`);
  }
  create(input: Body): Promise<AmenityBooking> {
    return this.http.post('/bookings', input);
  }
  update(id: string, input: Body): Promise<AmenityBooking> {
    return this.http.patch(`/bookings/${id}`, input);
  }
  cancel(id: string, reason?: string): Promise<AmenityBooking> {
    return this.http.post(`/bookings/${id}/cancel`, { reason });
  }
}

/** Announcements — publish and read community notices. */
export class AnnouncementsResource {
  constructor(private readonly http: HttpClient) {}

  list(params: { communityId: string } & Query): Promise<Paginated<Announcement>> {
    return this.http.get('/announcements', params);
  }
  get(id: string): Promise<Announcement> {
    return this.http.get(`/announcements/${id}`);
  }
  create(input: Body): Promise<Announcement> {
    return this.http.post('/announcements', input);
  }
  update(id: string, input: Body): Promise<Announcement> {
    return this.http.patch(`/announcements/${id}`, input);
  }
  remove(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/announcements/${id}`);
  }
  publish(id: string): Promise<Announcement> {
    return this.http.post(`/announcements/${id}/publish`, {});
  }
  expire(id: string): Promise<Announcement> {
    return this.http.post(`/announcements/${id}/expire`, {});
  }
}

/**
 * Amenities — the Community Foundation's amenity register (reused). Focused
 * namespace over the existing `/communities/:id/amenities` endpoints.
 */
export class AmenitiesResource {
  constructor(private readonly http: HttpClient) {}

  list(communityId: string, params?: Query): Promise<Paginated<Amenity>> {
    return this.http.get(`/communities/${communityId}/amenities`, params);
  }
  get(id: string): Promise<Amenity> {
    return this.http.get(`/amenities/${id}`);
  }
  create(communityId: string, input: Body): Promise<Amenity> {
    return this.http.post(`/communities/${communityId}/amenities`, input);
  }
  update(id: string, input: Body): Promise<Amenity> {
    return this.http.patch(`/amenities/${id}`, input);
  }
  remove(id: string): Promise<unknown> {
    return this.http.delete(`/amenities/${id}`);
  }
}

/**
 * Community documents — the Community Foundation's document register (reused),
 * with the StorageService signed-URL upload flow.
 */
export class DocumentsResource {
  constructor(private readonly http: HttpClient) {}

  list(communityId: string, params?: Query): Promise<Paginated<CommunityDocument>> {
    return this.http.get(`/communities/${communityId}/documents`, params);
  }
  get(id: string): Promise<CommunityDocument> {
    return this.http.get(`/documents/${id}`);
  }
  uploadUrl(
    communityId: string,
    input: { fileName: string; contentType?: string },
  ): Promise<{ key: string; uploadUrl: string; expiresAt: string }> {
    return this.http.post(`/communities/${communityId}/documents/upload-url`, input);
  }
  create(communityId: string, input: Body): Promise<CommunityDocument> {
    return this.http.post(`/communities/${communityId}/documents`, input);
  }
  update(id: string, input: Body): Promise<CommunityDocument> {
    return this.http.patch(`/documents/${id}`, input);
  }
  remove(id: string): Promise<unknown> {
    return this.http.delete(`/documents/${id}`);
  }
}
