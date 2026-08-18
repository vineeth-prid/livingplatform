import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Asset } from '@living/types';

import { living } from '../../lib/living';

const key = (id: string) => ['asset', id] as const;

export function useAsset(id: string) {
  return useQuery({ queryKey: key(id), queryFn: () => living.assets.get(id) });
}

export function useAssetEvents(id: string, enabled = true) {
  return useQuery({ queryKey: ['asset', id, 'events'], queryFn: () => living.assets.events(id), enabled });
}

export function useAssetPhotos(id: string, enabled = true) {
  return useQuery({ queryKey: ['asset', id, 'photos'], queryFn: () => living.assets.photos(id), enabled });
}

export function useAssetDocuments(id: string, enabled = true) {
  return useQuery({ queryKey: ['asset', id, 'documents'], queryFn: () => living.assets.documents(id), enabled });
}

/** Active asset categories for a community (for filters + the create form). */
export function useAssetCategories(communityId: string | null) {
  return useQuery({
    queryKey: ['asset-categories', communityId],
    queryFn: () => living.assetCategories.list({ communityId: communityId!, limit: 200, activeOnly: true, sortBy: 'name', sortDir: 'asc' }),
    enabled: !!communityId,
  });
}

/** Blocks + floors for the community (location selects + filters). */
export function useLocationOptions(communityId: string | null) {
  const blocks = useQuery({
    queryKey: ['blocks', communityId],
    queryFn: () => living.community.listBlocks(communityId!, { limit: 200, sortBy: 'name', sortDir: 'asc' }),
    enabled: !!communityId,
  });
  const floors = useQuery({
    queryKey: ['floors', communityId],
    queryFn: () => living.community.listFloors(communityId!, { limit: 500 }),
    enabled: !!communityId,
  });
  return { blocks: blocks.data?.items ?? [], floors: floors.data?.items ?? [] };
}

export function useAssetMutations(id?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['assets'] });
    if (id) void qc.invalidateQueries({ queryKey: key(id) });
  };

  const create = useMutation({
    mutationFn: (input: Record<string, unknown>) => living.assets.create(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) => living.assets.update(id!, input),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: () => living.assets.archive(id!),
    onSuccess: invalidate,
  });

  /**
   * PUT the bytes, then register the row — in that order, so a record never
   * exists without an object behind it.
   *
   * This step was missing: the portal asked for a signed URL, ignored it, and
   * saved a photo pointing at something never stored. Every asset photo since
   * has been an empty reference, which is why the gallery showed "Preview
   * unavailable" for all of them. The workforce app had the identical bug and
   * was fixed; this copy was left behind.
   */
  async function putBytes(uploadUrl: string, file: File, contentType: string) {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!res.ok) throw new Error('Could not upload the file — check your connection');
  }

  const addPhoto = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      const contentType = file.type || 'application/octet-stream';
      const signed = await living.assets.photoUploadUrl(id!, { fileName: file.name, contentType });
      await putBytes(signed.uploadUrl, file, contentType);
      return living.assets.addPhoto(id!, { storageKey: signed.key, caption });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset', id, 'photos'] }),
  });

  const removePhoto = useMutation({
    mutationFn: (photoId: string) => living.assets.removePhoto(id!, photoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset', id, 'photos'] }),
  });

  const addDocument = useMutation({
    mutationFn: async (file: File) => {
      const contentType = file.type || 'application/octet-stream';
      const signed = await living.assets.documentUploadUrl(id!, { fileName: file.name, contentType });
      await putBytes(signed.uploadUrl, file, contentType);
      return living.assets.addDocument(id!, { fileName: file.name, storageKey: signed.key, mimeType: contentType });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset', id, 'documents'] }),
  });

  return { create, update, archive, addPhoto, removePhoto, addDocument };
}

export type { Asset };
