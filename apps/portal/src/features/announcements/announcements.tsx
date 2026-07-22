import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Send, Trash2, XCircle } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import type { Announcement } from '@living/types';
import { Badge, type BadgeProps, Button, Input, Sheet, SheetContent, toast, useConfirm } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { living } from '../../lib/living';
import { ListScaffold, useListQuery, type ListColumn } from '../master-data';
import { opt } from '../master-data/options';
import { FormFooter, FormSection, SelectField, TextAreaField } from '../shared/form-kit';

type Tone = NonNullable<BadgeProps['tone']>;
const PRIORITY = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
const P_TONE: Record<string, Tone> = { LOW: 'neutral', NORMAL: 'info', HIGH: 'warning', CRITICAL: 'danger' };
const S_TONE: Record<string, Tone> = { DRAFT: 'neutral', PUBLISHED: 'success', EXPIRED: 'neutral' };
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();

export function AnnouncementsPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useListQuery<Announcement>({
    queryKey: ['announcements', communityId ?? ''],
    basePath: '/announcements',
    filterKeys: ['priority', 'status'],
    defaultSort: 'publishAt',
    enabled: !!communityId,
    fetch: (params) => living.announcements.list({ communityId: communityId!, ...params }),
  });

  const act = useMutation<unknown, Error, { id: string; action: 'publish' | 'expire' | 'remove' }>({
    mutationFn: ({ id, action }) => living.announcements[action](id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['announcements'] }); },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Action failed'),
  });
  const onRemove = async (a: Announcement) => {
    if (!(await confirm({ title: `Delete “${a.title}”?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    act.mutate({ id: a.id, action: 'remove' });
  };

  const canPublish = hasPermission('announcement:publish');
  const canEdit = hasPermission('announcement:update');

  const columns: ListColumn<Announcement>[] = [
    { key: 'title', header: 'Announcement', cell: (a) => <div className="min-w-0"><p className="truncate font-medium text-strong">{a.title}</p><p className="truncate text-xs text-subtle">{a.content}</p></div> },
    { key: 'priority', header: 'Priority', sortKey: 'priority', cell: (a) => <Badge tone={P_TONE[a.priority] ?? 'neutral'} size="sm" dot>{humanize(a.priority)}</Badge> },
    { key: 'status', header: 'Status', cell: (a) => <Badge tone={S_TONE[a.status] ?? 'neutral'} size="sm" dot>{humanize(a.status)}</Badge> },
    { key: 'publish', header: 'Publish', sortKey: 'publishAt', cell: (a) => <span className="text-sm text-muted">{a.publishAt ? formatDate(a.publishAt) : '—'}</span> },
    {
      key: 'actions', header: '', align: 'right', cell: (a) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canPublish && a.status === 'DRAFT' && <Button size="sm" onClick={() => act.mutate({ id: a.id, action: 'publish' })}><Send className="h-4 w-4" /> Publish</Button>}
          {canPublish && a.status === 'PUBLISHED' && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: a.id, action: 'expire' })}><XCircle className="h-4 w-4" /> Expire</Button>}
          {canEdit && <button onClick={() => setEditing(a)} aria-label="Edit" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-body"><Pencil className="h-4 w-4" /></button>}
          {canEdit && <button onClick={() => onRemove(a)} aria-label="Delete" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-danger-fg"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <ListScaffold
        title="Announcements"
        description="Community notices — draft, publish and expire."
        query={list}
        columns={columns}
        rowKey={(a) => a.id}
        searchPlaceholder="Search announcements…"
        filters={[{ key: 'priority', placeholder: 'All priorities', options: opt(PRIORITY) }, { key: 'status', placeholder: 'All statuses', options: opt(['DRAFT', 'PUBLISHED', 'EXPIRED']) }]}
        createPermission="announcement:create"
        createLabel="New announcement"
        onCreate={() => setCreating(true)}
      />
      {communityId && <AnnouncementDrawer key={editing?.id ?? 'new'} communityId={communityId} announcement={editing} open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => list.refetch()} />}
    </>
  );
}

const dateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

function AnnouncementDrawer({ communityId, announcement, open, onClose, onSaved }: { communityId: string; announcement: Announcement | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const editing = !!announcement;
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [content, setContent] = useState(announcement?.content ?? '');
  const [priority, setPriority] = useState(announcement?.priority ?? 'NORMAL');
  const [publishAt, setPublishAt] = useState(dateInput(announcement?.publishAt));
  const [expiresAt, setExpiresAt] = useState(dateInput(announcement?.expiresAt));

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => editing ? living.announcements.update(announcement!.id, body) : living.announcements.create(body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Saved'); onClose(); onSaved(); },
    onError: (err) => toast.error(err instanceof LivingApiError ? err.message : 'Could not save'),
  });

  const submit = () => {
    if (!title.trim() || !content.trim()) { toast.error('Title and content are required'); return; }
    save.mutate({
      ...(editing ? {} : { communityId }),
      title: title.trim(), content: content.trim(), priority,
      publishAt: publishAt ? new Date(publishAt).toISOString() : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent open={open} side="right" title={editing ? 'Edit announcement' : 'New announcement'} className="w-[min(94vw,560px)]">
        <div className="flex flex-col gap-5">
          <FormSection title="Content">
            <div className="flex flex-col gap-4">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Water supply interruption on Sunday" />
              <TextAreaField label="Content" value={content} onChange={setContent} rows={6} />
              <SelectField label="Priority" value={priority} onChange={(v) => setPriority(v as 'NORMAL')} options={PRIORITY.map((p) => ({ value: p, label: humanize(p) }))} />
            </div>
          </FormSection>
          <FormSection title="Schedule" description="Optional — leave blank to publish manually. Set an expiry to auto-hide.">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Publish at" type="date" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
              <Input label="Expires at" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </FormSection>
          <FormFooter submitLabel={editing ? 'Save changes' : 'Create draft'} submitting={save.isPending} onSubmit={submit} onCancel={onClose} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
