import { type ReactNode, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera, CheckCircle2, Gauge, ImagePlus, Lock, MessageSquare, Paperclip,
} from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { cn, formatFileSize, timeAgo } from '@living/utils';
import {
  Avatar, Badge, Button, EmptyState, Skeleton, Timeline, toast, type TimelineItem,
} from '@living/ui';
import type { TicketAttachment, TimelineEvent, WorkOrderAttachment } from '@living/types';

import { living } from './lib/living';

/** A calm horizontal progress meter (0–100). */
export function ProgressMeter({ percent, label }: { percent: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-body">{label ?? 'Progress'}</span>
        <span className="font-mono text-sm font-medium text-strong" data-numeric>{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-pill bg-sunken">
        <div className="h-full rounded-pill bg-brand transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Work-order progress updates ───────────────────────────────────────────────

/** Progress %, update history, and a composer — the work order's activity log. */
export function WorkOrderProgress({ id, canUpdate }: { id: string; canUpdate: boolean }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const meId = session?.user.id;
  const [comment, setComment] = useState('');
  const [percent, setPercent] = useState('');
  const [internal, setInternal] = useState(false);

  const q = useQuery({ queryKey: ['job', 'work-order', id, 'updates'], queryFn: () => living.workOrder.listUpdates(id) });
  const updates = q.data ?? [];
  const latestPercent = useMemo(() => [...updates].reverse().find((u) => u.progressPercent != null)?.progressPercent, [updates]);

  const add = useMutation({
    mutationFn: (input: { comment: string; progressPercent?: number; isInternal?: boolean }) => living.workOrder.addUpdate(id, input),
    onSuccess: () => { void q.refetch(); void qc.invalidateQueries({ queryKey: ['job', 'work-order', id, 'timeline'] }); },
  });

  async function submit() {
    const text = comment.trim();
    if (!text) return;
    try {
      await add.mutateAsync({
        comment: text,
        progressPercent: percent !== '' ? Math.max(0, Math.min(100, Number(percent))) : undefined,
        isInternal: internal,
      });
      setComment(''); setPercent(''); setInternal(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add update');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {latestPercent != null && <ProgressMeter percent={latestPercent} />}

      {q.isLoading ? (
        <Skeleton className="h-12" />
      ) : updates.length === 0 ? (
        <EmptyState icon={Gauge} title="No updates yet" description="Post progress as work happens." />
      ) : (
        <ul className="flex flex-col gap-3">
          {updates.map((u) => (
            <li key={u.id} className="flex gap-3">
              <Avatar name={u.authorId === meId ? (session?.user.firstName ?? 'You') : 'User'} size="sm" />
              <div className={cn('flex-1 rounded-lg px-3.5 py-2.5', u.isInternal ? 'bg-[var(--warning-bg)]' : 'bg-sunken')}>
                <div className="mb-1 flex items-center gap-2">
                  {u.progressPercent != null && <Badge tone="brand" size="sm">{u.progressPercent}%</Badge>}
                  {u.isInternal && <Badge tone="warning" size="sm"><Lock className="h-3 w-3" /> Internal</Badge>}
                  <span className="text-2xs text-subtle">{timeAgo(u.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-body">{u.comment}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpdate && (
        <div className="rounded-control border border-border bg-raised p-2 focus-within:shadow-ring">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Post a progress update…" rows={2}
            className="w-full resize-none bg-transparent px-1.5 py-1 text-sm text-strong outline-none placeholder:text-subtle" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="number" min={0} max={100} inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)}
                  placeholder="%" className="h-9 w-16 rounded-md border border-border bg-page px-2 text-sm text-strong outline-none" />
                progress
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-[var(--brand-primary)]" />
                Internal
              </label>
            </div>
            <Button size="sm" onClick={submit} loading={add.isPending} disabled={!comment.trim()}>Post update</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ticket notes (worker comments) ────────────────────────────────────────────

/** A ticket's public/internal notes — the worker's running log on a complaint. */
export function TicketNotes({ id, canComment }: { id: string; canComment: boolean }) {
  const { session } = useAuth();
  const meId = session?.user.id;
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const q = useQuery({ queryKey: ['job', 'ticket', id, 'comments'], queryFn: () => living.ticket.listComments(id) });
  const comments = q.data ?? [];

  const add = useMutation({
    mutationFn: (input: { body: string; isInternal: boolean }) => living.ticket.addComment(id, input.body, input.isInternal),
    onSuccess: () => q.refetch(),
  });

  async function send() {
    const text = body.trim();
    if (!text) return;
    try {
      await add.mutateAsync({ body: text, isInternal: internal });
      setBody(''); setInternal(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add note');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {q.isLoading ? (
        <Skeleton className="h-12" />
      ) : comments.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No notes yet" description="Log what you find or do here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.authorId === meId ? (session?.user.firstName ?? 'You') : 'User'} size="sm" />
              <div className={cn('flex-1 rounded-lg px-3.5 py-2.5', c.isInternal ? 'bg-[var(--warning-bg)]' : 'bg-sunken')}>
                <div className="mb-1 flex items-center gap-2">
                  {c.isInternal && <Badge tone="warning" size="sm"><Lock className="h-3 w-3" /> Internal</Badge>}
                  <span className="text-2xs text-subtle">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-body">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <div className="rounded-control border border-border bg-raised p-2 focus-within:shadow-ring">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" rows={2}
            className="w-full resize-none bg-transparent px-1.5 py-1 text-sm text-strong outline-none placeholder:text-subtle" />
          <div className="flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-[var(--brand-primary)]" />
              Internal
            </label>
            <Button size="sm" onClick={send} loading={add.isPending} disabled={!body.trim()}>Add note</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Photos / attachments (work orders + tickets) ──────────────────────────────

type Attachment = WorkOrderAttachment | TicketAttachment;
interface AttachmentApi {
  list: () => Promise<Attachment[]>;
  uploadUrl: (input: { fileName: string; contentType?: string }) => Promise<{ key: string }>;
  add: (input: Record<string, unknown>) => Promise<Attachment>;
}

const isImage = (a: Attachment) => a.contentType?.startsWith('image/');

/**
 * Photo capture + attachment list. "Take photo" opens the camera; "Upload"
 * opens the gallery/files. Chosen files preview as thumbnails, then register
 * via the StorageService signed-URL flow.
 *
 * ponytail: storage is a metadata-only stub, so we register the record without
 * the byte PUT — exactly the portal's behaviour. When a real provider lands, add
 * the `fetch(uploadUrl, { method: 'PUT', body: file })` step; nothing else changes.
 */
export function PhotoPanel({ queryKey, api, canAdd }: { queryKey: unknown[]; api: AttachmentApi; canAdd: boolean }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<File[]>([]);
  const q = useQuery({ queryKey, queryFn: api.list });
  const attachments = q.data ?? [];

  const previews = useMemo(() => staged.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [staged]);

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const contentType = file.type || 'application/octet-stream';
        const signed = await api.uploadUrl({ fileName: file.name, contentType });
        await api.add({ fileName: file.name, contentType, size: file.size, storageKey: signed.key });
      }
    },
    onSuccess: () => { setStaged([]); void q.refetch(); toast.success('Photos added'); },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Upload failed'),
  });

  const onPick = (files: FileList | null) => {
    if (files && files.length) setStaged((prev) => [...prev, ...Array.from(files)]);
  };

  return (
    <div className="flex flex-col gap-3">
      {q.isLoading ? (
        <Skeleton className="h-10" />
      ) : attachments.length === 0 && staged.length === 0 ? (
        <EmptyState icon={Camera} title="No photos yet" description="Capture before/after shots on site." />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((a) => (
            <a key={a.id} href={a.downloadUrl ?? undefined} target="_blank" rel="noreferrer"
              className="group relative aspect-square overflow-hidden rounded-card bg-sunken focus-visible:outline-none focus-visible:shadow-ring">
              {isImage(a) && a.downloadUrl ? (
                <img src={a.downloadUrl} alt={a.fileName} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                  <Paperclip className="h-5 w-5 text-muted" />
                  <span className="line-clamp-2 text-2xs text-subtle">{a.fileName}</span>
                  <span className="text-2xs text-subtle">{formatFileSize(a.size)}</span>
                </span>
              )}
            </a>
          ))}
          {previews.map((p, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-card ring-1 ring-inset ring-[var(--brand-primary)]/40">
              <img src={p.url} alt={p.file.name} className="h-full w-full object-cover opacity-80" />
              <span className="absolute inset-x-0 bottom-0 bg-black/40 px-1 py-0.5 text-center text-2xs text-white">Ready</span>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="flex flex-col gap-2">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPick(e.target.files)} />
          <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPick(e.target.files)} />
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4" /> Take photo
            </Button>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Upload
            </Button>
          </div>
          {staged.length > 0 && (
            <div className="flex items-center gap-2">
              <Button size="lg" className="flex-1" loading={upload.isPending} onClick={() => upload.mutate(staged)}>
                <CheckCircle2 className="h-4 w-4" /> Add {staged.length} photo{staged.length > 1 ? 's' : ''}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setStaged([])} disabled={upload.isPending}>Clear</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Timeline (work orders + tickets) ──────────────────────────────────────────

function describe(e: TimelineEvent): string {
  if (e.type === 'STATUS_CHANGED' && e.reference) return `Status: ${e.reference.replace('->', ' → ').toLowerCase()}`;
  if (e.type === 'PROGRESS_UPDATED') {
    const pct = (e.metadata as { progressPercent?: number } | null)?.progressPercent;
    return pct != null ? `Progress — ${pct}%` : 'Progress updated';
  }
  return e.type.charAt(0) + e.type.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** The structured event log → shared Timeline. */
export function TimelinePanel({ queryKey, load }: { queryKey: unknown[]; load: () => Promise<TimelineEvent[]> }) {
  const q = useQuery({ queryKey, queryFn: load });
  if (q.isLoading) return <Skeleton className="h-16" />;
  const events = q.data ?? [];
  if (events.length === 0) return <p className="text-sm text-subtle">Updates will appear here.</p>;
  const items: TimelineItem[] = events.map<TimelineItem>((e) => ({ id: e.id, title: describe(e), timestamp: timeAgo(e.createdAt) }));
  return <Timeline items={items} />;
}

/** A labelled meta row used across the detail sections. */
export function MetaRow({ icon: Icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2.5 text-sm text-muted">{Icon} {label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-strong">{children}</span>
    </div>
  );
}
