import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, Download, Paperclip } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { formatFileSize } from '@living/utils';
import { Badge, Button, EmptyState, Skeleton, toast } from '@living/ui';

/** BEFORE / AFTER when the file is site evidence; undefined for an invoice or spec. */
export type EvidenceStage = 'BEFORE' | 'AFTER' | undefined;

interface Attachment {
  id: string;
  fileName: string;
  contentType?: string | null;
  size: number;
  downloadUrl?: string | null;
}

export interface AttachmentApi {
  list: () => Promise<Attachment[]>;
  uploadUrl: (
    input: { fileName: string; contentType: string },
  ) => Promise<{ key: string; uploadUrl: string }>;
  add: (input: Record<string, unknown>) => Promise<unknown>;
}

const stageOf = (a: unknown) => (a as { stage?: 'BEFORE' | 'AFTER' | null }).stage ?? null;

/**
 * Attachments for a work order or a ticket — one panel, because both carry the
 * same obligation and both were broken the same two ways.
 *
 * The bytes were never sent: the signed URL was requested and thrown away, and
 * only the metadata row was written. Every file the portal "uploaded" pointed at
 * an object that did not exist and would not open.
 *
 * And there was no way to mark a photo BEFORE or AFTER. The API refuses to
 * complete a work order (or resolve a ticket) without an AFTER photo, so an
 * admin closing out a job themselves met a requirement no control on the screen
 * could satisfy — the only place that could tag a stage was the workforce app.
 */
export function AttachmentPanel({
  queryKey, api, canAdd, evidenceHint,
}: {
  queryKey: unknown[];
  api: AttachmentApi;
  canAdd: boolean;
  /** Wording for the before/after requirement, e.g. "…to complete it". */
  evidenceHint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Which button was pressed. The file dialog is shared, so the stage has to
  // survive until the picker comes back.
  const pendingStage = useRef<EvidenceStage>(undefined);
  const [busy, setBusy] = useState<'BEFORE' | 'AFTER' | 'file' | null>(null);

  const q = useQuery({ queryKey, queryFn: api.list });
  const attachments = q.data ?? [];

  function pick(stage: EvidenceStage, accept: string) {
    if (!inputRef.current) return;
    pendingStage.current = stage;
    setBusy(stage ?? 'file');
    inputRef.current.accept = accept;
    inputRef.current.click();
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) { setBusy(null); return; }
    const stage = pendingStage.current;
    try {
      for (const file of Array.from(files)) {
        const contentType = file.type || 'application/octet-stream';
        const signed = await api.uploadUrl({ fileName: file.name, contentType });
        const put = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        });
        if (!put.ok) throw new Error('Could not upload the file — check your connection');
        await api.add({
          fileName: file.name, contentType, size: file.size, storageKey: signed.key,
          ...(stage ? { stage } : {}),
        });
      }
      await q.refetch();
      toast.success(stage ? `${stage === 'BEFORE' ? 'Before' : 'After'} photo added` : 'Attachment added');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(null);
      pendingStage.current = undefined;
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {q.isLoading ? (
        <Skeleton className="h-10" />
      ) : attachments.length === 0 ? (
        <EmptyState icon={Paperclip} title="No attachments" />
      ) : (
        <ul className="flex flex-col gap-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-sunken">
              {/* Thumbnail, not a paperclip. Site evidence is the point of these
                  rows — a verifier comparing before and after should not have to
                  open each file in a new tab to see which is which. */}
              {a.contentType?.startsWith('image/') && a.downloadUrl ? (
                <a href={a.downloadUrl} target="_blank" rel="noreferrer"
                  className="shrink-0 overflow-hidden rounded-md focus-visible:shadow-ring">
                  <img src={a.downloadUrl} alt={a.fileName} loading="lazy" className="h-10 w-10 object-cover" />
                </a>
              ) : (
                <Paperclip className="h-4 w-4 shrink-0 text-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-strong">
                  <span className="truncate">{a.fileName}</span>
                  {stageOf(a) && (
                    <Badge tone={stageOf(a) === 'BEFORE' ? 'neutral' : 'success'} size="sm">
                      {stageOf(a) === 'BEFORE' ? 'before' : 'after'}
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-subtle">{formatFileSize(a.size)}</p>
              </div>
              {a.downloadUrl && (
                <a href={a.downloadUrl} target="_blank" rel="noreferrer"
                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-tint hover:text-brand"
                  aria-label={`Download ${a.fileName}`}>
                  <Download className="h-4 w-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={busy === 'BEFORE'} onClick={() => pick('BEFORE', 'image/*')}>
              <Camera className="h-4 w-4" /> Add before photo
            </Button>
            <Button variant="secondary" size="sm" loading={busy === 'AFTER'} onClick={() => pick('AFTER', 'image/*')}>
              <Camera className="h-4 w-4" /> Add after photo
            </Button>
            <Button variant="ghost" size="sm" loading={busy === 'file'} onClick={() => pick(undefined, '')}>
              <Paperclip className="h-4 w-4" /> Attach file
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-subtle">{evidenceHint}</p>
        </div>
      )}
    </div>
  );
}
