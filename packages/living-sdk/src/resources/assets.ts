import type {
  Asset, AssetCategory, AssetDocument, AssetEvent, AssetPhoto, ListParams, Paginated,
} from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/** Asset Engine: the asset register, documents, photos and immutable history. */
export class AssetResource {
  constructor(private readonly http: HttpClient) {}

  list(params: { communityId: string } & Query): Promise<Paginated<Asset>> {
    return this.http.get('/assets', params);
  }
  get(id: string): Promise<Asset> {
    return this.http.get(`/assets/${id}`);
  }
  create(input: Body): Promise<Asset> {
    return this.http.post('/assets', input);
  }
  update(id: string, input: Body): Promise<Asset> {
    return this.http.patch(`/assets/${id}`, input);
  }
  /** Soft-delete (archive) — history is retained. */
  archive(id: string): Promise<{ id: string; archived: boolean }> {
    return this.http.delete(`/assets/${id}`);
  }

  // History
  events(id: string): Promise<AssetEvent[]> {
    return this.http.get(`/assets/${id}/events`);
  }

  // Documents (metadata via StorageService)
  documents(id: string): Promise<AssetDocument[]> {
    return this.http.get(`/assets/${id}/documents`);
  }
  documentUploadUrl(
    id: string,
    input: { fileName: string; contentType?: string },
  ): Promise<{ key: string; uploadUrl: string; expiresAt: string }> {
    return this.http.post(`/assets/${id}/documents/upload-url`, input);
  }
  addDocument(id: string, input: Body): Promise<AssetDocument> {
    return this.http.post(`/assets/${id}/documents`, input);
  }

  // Photos (metadata via StorageService)
  photos(id: string): Promise<AssetPhoto[]> {
    return this.http.get(`/assets/${id}/photos`);
  }
  photoUploadUrl(
    id: string,
    input: { fileName: string; contentType?: string },
  ): Promise<{ key: string; uploadUrl: string; expiresAt: string }> {
    return this.http.post(`/assets/${id}/photos/upload-url`, input);
  }
  addPhoto(id: string, input: Body): Promise<AssetPhoto> {
    return this.http.post(`/assets/${id}/photos`, input);
  }
}

/** Asset categories: the community-scoped, self-nesting taxonomy. */
export class AssetCategoryResource {
  constructor(private readonly http: HttpClient) {}

  list(params: { communityId: string } & Query): Promise<Paginated<AssetCategory>> {
    return this.http.get('/asset-categories', params);
  }
  get(id: string): Promise<AssetCategory> {
    return this.http.get(`/asset-categories/${id}`);
  }
  create(input: Body): Promise<AssetCategory> {
    return this.http.post('/asset-categories', input);
  }
  update(id: string, input: Body): Promise<AssetCategory> {
    return this.http.patch(`/asset-categories/${id}`, input);
  }
  remove(id: string): Promise<unknown> {
    return this.http.delete(`/asset-categories/${id}`);
  }
}
