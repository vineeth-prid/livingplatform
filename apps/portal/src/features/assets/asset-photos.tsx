import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ImageOff, Upload, X } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { Button, Dialog, DialogContent, EmptyState, Skeleton, toast } from '@living/ui';
import type { AssetPhoto } from '@living/types';

import { useAssetMutations, useAssetPhotos } from './queries';

/** Asset photo gallery: a responsive grid with an animated lightbox, upload
 *  and per-photo removal. Bytes are signed URLs from the private bucket. */
export function AssetPhotos({ assetId, canEdit }: { assetId: string; canEdit: boolean }) {
  const q = useAssetPhotos(assetId);
  const { addPhoto, removePhoto } = useAssetMutations(assetId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<AssetPhoto | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const photos = q.data ?? [];

  async function onRemove(photoId: string) {
    setRemovingId(photoId);
    try {
      await removePhoto.mutateAsync(photoId);
      // Close the lightbox if it was showing the photo just removed.
      setActive((cur) => (cur?.id === photoId ? null : cur));
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not remove the photo');
    } finally {
      setRemovingId(null);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      for (const file of Array.from(files)) await addPhoto.mutateAsync({ file });
      toast.success('Photo added');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add photo');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
          <Button variant="secondary" size="sm" loading={addPhoto.isPending} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload photos
          </Button>
        </div>
      )}

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-card" />)}
        </div>
      ) : photos.length === 0 ? (
        <EmptyState icon={Camera} title="No photos" description="Upload site photos of this asset." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-card bg-sunken">
              <button onClick={() => setActive(p)} aria-label={p.caption ?? 'Open photo'}
                className="h-full w-full focus-visible:outline-none focus-visible:shadow-ring">
                <PhotoImg photo={p} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" />
              </button>
              {/* A wrong or blurred shot was permanent — the gallery offered no
                  way to take one back. */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void onRemove(p.id)}
                  disabled={removingId === p.id}
                  aria-label={`Remove ${p.caption ?? 'photo'}`}
                  className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80 disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent open={!!active} className="max-w-3xl bg-transparent p-0 shadow-none">
          <AnimatePresence>
            {active && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }} className="relative overflow-hidden rounded-2xl bg-card">
                <button onClick={() => setActive(null)} aria-label="Close"
                  className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60">
                  <X className="h-4 w-4" />
                </button>
                <PhotoImg photo={active} className="max-h-[75vh] w-full object-contain" />
                {active.caption && <p className="px-4 py-3 text-sm text-body">{active.caption}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** An image that falls back to a placeholder when the bytes don't resolve —
 *  a signed URL that has expired, or an object removed out from under the row. */
function PhotoImg({ photo, className }: { photo: AssetPhoto; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (broken || !photo.url) {
    return (
      <div className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-1 text-subtle">
        <ImageOff className="h-6 w-6" />
        <span className="px-2 text-center text-2xs">{photo.caption ?? 'Preview unavailable'}</span>
      </div>
    );
  }
  return <img src={photo.url} alt={photo.caption ?? 'Asset photo'} loading="lazy" className={className} onError={() => setBroken(true)} />;
}
