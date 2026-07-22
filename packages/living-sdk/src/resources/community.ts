import type {
  Amenity, Block, Community, CommunityDocument, CommunitySearchResult,
  Floor, ListParams, Paginated, Phase, Unit,
} from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/** Community Foundation: communities, property hierarchy, units, amenities,
 *  settings, documents and in-community search. */
export class CommunityResource {
  constructor(private readonly http: HttpClient) {}

  list(params?: Query): Promise<Paginated<Community>> {
    return this.http.get('/communities', params);
  }
  get(id: string): Promise<Community> {
    return this.http.get(`/communities/${id}`);
  }
  create(input: Body): Promise<Community> {
    return this.http.post('/communities', input);
  }
  update(id: string, input: Body): Promise<Community> {
    return this.http.patch(`/communities/${id}`, input);
  }
  archive(id: string): Promise<Community> {
    return this.http.post(`/communities/${id}/archive`);
  }
  remove(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/communities/${id}`);
  }

  // ── Hierarchy: phases ──
  listPhases(communityId: string, params?: Query): Promise<Paginated<Phase>> {
    return this.http.get(`/communities/${communityId}/phases`, params);
  }
  createPhase(communityId: string, input: Body): Promise<Phase> {
    return this.http.post(`/communities/${communityId}/phases`, input);
  }
  getPhase(id: string): Promise<Phase> {
    return this.http.get(`/phases/${id}`);
  }
  updatePhase(id: string, input: Body): Promise<Phase> {
    return this.http.patch(`/phases/${id}`, input);
  }
  deletePhase(id: string): Promise<unknown> {
    return this.http.delete(`/phases/${id}`);
  }

  // ── Hierarchy: blocks ──
  listBlocks(communityId: string, params?: Query): Promise<Paginated<Block>> {
    return this.http.get(`/communities/${communityId}/blocks`, params);
  }
  createBlock(communityId: string, input: Body): Promise<Block> {
    return this.http.post(`/communities/${communityId}/blocks`, input);
  }
  getBlock(id: string): Promise<Block> {
    return this.http.get(`/blocks/${id}`);
  }
  updateBlock(id: string, input: Body): Promise<Block> {
    return this.http.patch(`/blocks/${id}`, input);
  }
  deleteBlock(id: string): Promise<unknown> {
    return this.http.delete(`/blocks/${id}`);
  }

  // ── Hierarchy: floors ──
  listFloors(communityId: string, params?: Query): Promise<Paginated<Floor>> {
    return this.http.get(`/communities/${communityId}/floors`, params);
  }
  createFloor(input: Body): Promise<Floor> {
    return this.http.post('/floors', input);
  }
  getFloor(id: string): Promise<Floor> {
    return this.http.get(`/floors/${id}`);
  }
  updateFloor(id: string, input: Body): Promise<Floor> {
    return this.http.patch(`/floors/${id}`, input);
  }
  deleteFloor(id: string): Promise<unknown> {
    return this.http.delete(`/floors/${id}`);
  }

  // ── Units ──
  listUnits(communityId: string, params?: Query): Promise<Paginated<Unit>> {
    return this.http.get(`/communities/${communityId}/units`, params);
  }
  createUnit(communityId: string, input: Body): Promise<Unit> {
    return this.http.post(`/communities/${communityId}/units`, input);
  }
  getUnit(id: string): Promise<Unit> {
    return this.http.get(`/units/${id}`);
  }
  updateUnit(id: string, input: Body): Promise<Unit> {
    return this.http.patch(`/units/${id}`, input);
  }
  deleteUnit(id: string): Promise<unknown> {
    return this.http.delete(`/units/${id}`);
  }

  // ── Amenities ──
  listAmenities(communityId: string, params?: Query): Promise<Paginated<Amenity>> {
    return this.http.get(`/communities/${communityId}/amenities`, params);
  }
  createAmenity(communityId: string, input: Body): Promise<Amenity> {
    return this.http.post(`/communities/${communityId}/amenities`, input);
  }
  getAmenity(id: string): Promise<Amenity> {
    return this.http.get(`/amenities/${id}`);
  }
  updateAmenity(id: string, input: Body): Promise<Amenity> {
    return this.http.patch(`/amenities/${id}`, input);
  }
  deleteAmenity(id: string): Promise<unknown> {
    return this.http.delete(`/amenities/${id}`);
  }

  // ── Settings ──
  getSettings<T = unknown>(communityId: string): Promise<T> {
    return this.http.get(`/communities/${communityId}/settings`);
  }
  updateSettings<T = unknown>(communityId: string, input: Body): Promise<T> {
    return this.http.put(`/communities/${communityId}/settings`, input);
  }

  // ── Documents ──
  listDocuments(communityId: string, params?: Query): Promise<Paginated<CommunityDocument>> {
    return this.http.get(`/communities/${communityId}/documents`, params);
  }
  createDocument(communityId: string, input: Body): Promise<CommunityDocument> {
    return this.http.post(`/communities/${communityId}/documents`, input);
  }
  documentUploadUrl(
    communityId: string,
    input: { fileName: string; contentType?: string },
  ): Promise<{ key: string; uploadUrl: string; expiresAt: string }> {
    return this.http.post(`/communities/${communityId}/documents/upload-url`, input);
  }
  getDocument(id: string): Promise<CommunityDocument> {
    return this.http.get(`/documents/${id}`);
  }
  updateDocument(id: string, input: Body): Promise<CommunityDocument> {
    return this.http.patch(`/documents/${id}`, input);
  }
  deleteDocument(id: string): Promise<unknown> {
    return this.http.delete(`/documents/${id}`);
  }

  // ── Search ──
  search(communityId: string, q: string, limit?: number): Promise<CommunitySearchResult> {
    return this.http.get(`/communities/${communityId}/search`, { q, limit });
  }
}
