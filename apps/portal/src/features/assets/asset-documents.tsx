import { useRef } from 'react';
import { Download, FileText, Upload } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { formatDateTime } from '@living/utils';
import { Button, EmptyState, Skeleton, toast } from '@living/ui';

import { useAssetDocuments, useAssetMutations } from './queries';

/** Asset documents: list + upload + download (via StorageService signed URLs).
 *  No delete — the API has none. */
export function AssetDocuments({ assetId, canEdit }: { assetId: string; canEdit: boolean }) {
  const q = useAssetDocuments(assetId);
  const { addDocument } = useAssetMutations(assetId);
  const inputRef = useRef<HTMLInputElement>(null);
  const docs = q.data ?? [];

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      for (const file of Array.from(files)) await addDocument.mutateAsync(file);
      toast.success('Document added');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add document');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div>
          <input ref={inputRef} type="file" multiple hidden
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" onChange={(e) => void onFiles(e.target.files)} />
          <Button variant="secondary" size="sm" loading={addDocument.isPending} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Upload document
          </Button>
        </div>
      )}

      {q.isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-card" />)}</div>
      ) : docs.length === 0 ? (
        <EmptyState icon={FileText} title="No documents" description="Attach manuals, warranties and certificates." />
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-card border border-border-subtle">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-sunken">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-tint text-brand"><FileText className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-strong">{d.fileName}</p>
                <p className="text-xs text-subtle">{d.mimeType ?? 'File'} · {formatDateTime(d.createdAt)}</p>
              </div>
              {d.downloadUrl && (
                <a href={d.downloadUrl} target="_blank" rel="noreferrer" aria-label={`Download ${d.fileName}`}
                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-tint hover:text-brand">
                  <Download className="h-4 w-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
