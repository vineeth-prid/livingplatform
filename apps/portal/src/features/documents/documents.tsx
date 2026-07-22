import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Upload } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import type { CommunityDocument } from '@living/types';
import { Badge, Button, Input, Sheet, SheetContent, toast } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { SelectField } from '../shared/form-kit';

const CATEGORY = ['ASSOCIATION', 'RULES', 'POLICY', 'EMERGENCY_CONTACT', 'CERTIFICATE', 'GOVERNMENT_APPROVAL', 'MINUTES_OF_MEETING', 'OTHER'] as const;
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export function DocumentsPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const [uploading, setUploading] = useState(false);

  const list = useListQuery<CommunityDocument>({
    queryKey: ['documents', communityId ?? ''],
    basePath: '/documents',
    filterKeys: ['category', 'status'],
    defaultSort: 'createdAt',
    enabled: !!communityId,
    fetch: (params) => living.documents.list(communityId!, params),
  });

  const columns: ListColumn<CommunityDocument>[] = [
    { key: 'title', header: 'Document', sortKey: 'title', cell: (d) => <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-tint text-brand"><FileText className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate font-medium text-strong">{d.title}</p>{d.fileName && <p className="truncate text-xs text-subtle">{d.fileName}</p>}</div></div> },
    { key: 'category', header: 'Category', sortKey: 'category', cell: (d) => <Badge tone="neutral" size="sm">{humanize(d.category)}</Badge> },
    { key: 'updated', header: 'Updated', cell: (d) => <span className="text-sm text-muted">{formatDate(d.updatedAt)}</span> },
    { key: 'actions', header: '', align: 'right', cell: (d) => d.downloadUrl ? <a href={d.downloadUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-brand" aria-label={`Download ${d.title}`}><Download className="h-4 w-4" /></a> : null },
  ];

  return (
    <>
      <ListScaffold
        title="Documents"
        description="Bye-laws, policies, notices and certificates for the community."
        query={list}
        columns={columns}
        rowKey={(d) => d.id}
        onRowClick={(d) => d.downloadUrl && window.open(d.downloadUrl, '_blank')}
        searchPlaceholder="Search documents…"
        filters={[{ key: 'category', placeholder: 'All categories', options: opt(CATEGORY) }, { key: 'status', placeholder: 'All statuses', options: opt(['DRAFT', 'PUBLISHED', 'ARCHIVED']) }]}
        createPermission="document:create"
        createLabel="Upload"
        onCreate={() => setUploading(true)}
      />
      {communityId && hasPermission('document:create') && <UploadDrawer communityId={communityId} open={uploading} onClose={() => setUploading(false)} onSaved={() => list.refetch()} />}
    </>
  );
}

function UploadDrawer({ communityId, open, onClose, onSaved }: { communityId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('OTHER');

  const save = useMutation({
    mutationFn: async () => {
      if (!file || !title.trim()) throw new Error('Choose a file and title');
      const contentType = file.type || 'application/octet-stream';
      const signed = await living.documents.uploadUrl(communityId, { fileName: file.name, contentType });
      return living.documents.create(communityId, { title: title.trim(), category, status: 'PUBLISHED', storageKey: signed.key, fileName: file.name, mimeType: contentType, fileSize: file.size });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document uploaded'); setFile(null); setTitle(''); onClose(); onSaved(); },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : (err as Error).message),
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent open={open} side="right" title="Upload document" className="w-[min(94vw,480px)]">
        <div className="flex flex-col gap-4">
          <input ref={inputRef} type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); } }} />
          <Button variant="secondary" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> {file ? file.name : 'Choose file'}</Button>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Society bye-laws 2026" />
          <SelectField label="Category" value={category} onChange={setCategory} options={CATEGORY.map((c) => ({ value: c, label: humanize(c) }))} />
          <p className="text-xs text-subtle">Storage is a metadata stub this phase — the record registers; byte upload wires in with a real provider.</p>
          <div className="mt-2 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!file || !title.trim()}>Upload</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
