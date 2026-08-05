import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, Trash2 } from 'lucide-react';
import type { TicketCategory } from '@living/types';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, DataTable, EmptyState, Input, LoadingState, PageContainer, PageHeader,
  Sheet, SheetContent, toast, useConfirm, type Column,
} from '@living/ui';

import { living } from '../../lib/living';
import { FormGrid, FullWidth, TextAreaField } from '../shared/form-kit';

/**
 * The Categories catalogue — the vocabulary every request is raised against,
 * and the same list a staff member's specialities are picked from.
 *
 * Mirrors the Services catalogue, including the platform/community split: a
 * PLATFORM category (tenantId = null) is one row shared by every tenant, so it
 * can be used but not edited or deleted here. A community adds its own.
 */
export function CategoriesPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<TicketCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = hasPermission('ticket:update');

  const categories = useQuery({
    queryKey: ['ticket-categories', 'catalog'],
    queryFn: () => living.ticket.listCategories(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => living.ticket.deleteCategory(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ticket-categories'] });
      toast.success('Category deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onDelete = async (category: TicketCategory) => {
    const ok = await confirm({
      title: `Delete ${category.name}?`,
      description:
        'Existing requests keep their category and staff specialities referencing it are ' +
        'cleared. New requests can no longer be raised against it.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) remove.mutate(category.id);
  };

  const rows = categories.data ?? [];

  const columns: Column<TicketCategory>[] = [
    {
      key: 'name',
      header: 'Category',
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-6 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: c.color ?? 'var(--border)' }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-strong">{c.name}</p>
            <p className="truncate font-mono text-xs text-subtle">{c.key}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'origin',
      header: 'Origin',
      cell: (c) =>
        c.isSystem ? (
          <Badge tone="neutral" size="sm">platform</Badge>
        ) : (
          <Badge tone="brand" size="sm">community</Badge>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) =>
        c.isActive ? (
          <Badge tone="success" size="sm" dot>Active</Badge>
        ) : (
          <Badge tone="neutral" size="sm" dot>Inactive</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) =>
        canManage && !c.isSystem ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete ${c.name}`}
              disabled={remove.isPending}
              onClick={() => void onDelete(c)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Categories"
        description="What residents raise requests against, and what staff specialities are matched on."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New category
            </Button>
          ) : null
        }
      />

      {categories.isLoading ? (
        <LoadingState label="Loading categories…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Add one so residents can raise requests against it."
          action={canManage ? <Button onClick={() => setCreating(true)}>Add a category</Button> : undefined}
        />
      ) : (
        <Card variant="elevated" className="p-0">
          <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} />
        </Card>
      )}

      <CategoryDrawer
        key={editing?.id ?? 'new'}
        category={editing}
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
      />
    </PageContainer>
  );
}

function CategoryDrawer({
  category,
  open,
  onClose,
}: {
  category: TicketCategory | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = !!category;
  const [name, setName] = useState(category?.name ?? '');
  const [key, setKey] = useState(category?.key ?? '');
  const [color, setColor] = useState(category?.color ?? '#2F5D50');
  const [description, setDescription] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), color, description: description.trim() || undefined };
      return editing
        ? living.ticket.updateCategory(category.id, body)
        : living.ticket.createCategory({ ...body, key: key.trim().toUpperCase() });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ticket-categories'] });
      toast.success(editing ? 'Category updated' : 'Category created');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // The key is the stable identifier staff specialities and existing requests
  // point at, so it is set once and never edited.
  const canSave = name.trim().length > 0 && (editing || key.trim().length > 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        open={open}
        side="right"
        title={editing ? 'Edit category' : 'New category'}
        className="w-[min(94vw,480px)]"
      >
        <FormGrid>
          <FullWidth>
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="Plumbing" />
          </FullWidth>
          {!editing && (
            <FullWidth>
              <Input
                label="Key"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                required
                placeholder="PLUMBING"
                hint="Permanent identifier. Existing requests and staff specialities point at it."
              />
            </FullWidth>
          )}
          <FullWidth>
            <Input label="Colour" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </FullWidth>
          <FullWidth>
            <TextAreaField label="Description" value={description} onChange={setDescription} rows={3} />
          </FullWidth>
        </FormGrid>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
            {editing ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
