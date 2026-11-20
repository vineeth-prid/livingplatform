import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarDays, FolderCog, Hammer, Paperclip, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import type { Expense, ExpenseCategory, ExpenseFilters, ExpensePeriod, ExpenseSource } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, DataTable, EmptyState, Input, PageContainer, PageHeader, Pagination,
  SearchInput, Sheet, SheetContent, StatCard, toast, useConfirm, type Column,
} from '@living/ui';

import { living } from '../../lib/living';
import { inr } from '../billing/queries';
import { useCommunity } from '../community/community-context';
import { FormGrid, FormSection, FullWidth, SelectField, TextAreaField } from '../shared/form-kit';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'neft', label: 'NEFT / IMPS' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
];

type PeriodChoice = '' | ExpensePeriod | 'custom';
const PERIODS: { value: PeriodChoice; label: string }[] = [
  { value: '', label: 'All time' },
  { value: 'current-month', label: 'This month' },
  { value: 'previous-month', label: 'Last month' },
  { value: 'current-year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

const monthName = (ym?: string) =>
  ym ? new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';
const dayLabel = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Community Expense Manager — what the community spent, by category.
 *
 * Every figure comes from the expense rows (the API sums the filtered rows), so
 * the cards and the table total always agree with the list. Month filters use
 * the community's timezone. Work-order expenses arrive on their own when a
 * manager verifies a work order with an actual cost; they are linked back to it
 * and follow it, so they are not edited or deleted here.
 */
export function ExpensesPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('expense:manage');
  const confirm = useConfirm();
  const qc = useQueryClient();

  const [period, setPeriod] = useState<PeriodChoice>('current-month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [source, setSource] = useState<'' | ExpenseSource>('');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const filters: ExpenseFilters = useMemo(() => {
    const f: ExpenseFilters = {};
    if (period === 'custom') {
      if (from) f.from = from;
      if (to) f.to = to;
    } else if (period) f.period = period;
    if (categoryId) f.categoryId = categoryId;
    if (source) f.source = source;
    if (search) f.search = search;
    return f;
  }, [period, from, to, categoryId, source, search]);
  // A new filter starts from the first page.
  useEffect(() => setPage(1), [filters]);

  const categories = useQuery({
    queryKey: ['expenses', communityId, 'categories'],
    queryFn: () => living.expenses.categories(communityId!),
    enabled: !!communityId,
  });
  const summary = useQuery({
    queryKey: ['expenses', communityId, 'summary', filters],
    queryFn: () => living.expenses.summary(communityId!, filters),
    enabled: !!communityId,
  });
  const list = useQuery({
    queryKey: ['expenses', communityId, 'list', filters, page],
    queryFn: () => living.expenses.list(communityId!, { ...filters, page, limit: 20, sortBy: 'expenseDate', sortDir: 'desc' }),
    enabled: !!communityId,
  });

  const remove = useMutation({
    mutationFn: (id: string) => living.expenses.remove(communityId!, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses', communityId] });
      toast.success('Expense deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const invalidRange = period === 'custom' && !!from && !!to && from > to;

  const columns: Column<Expense>[] = [
    {
      key: 'title',
      header: 'Expense',
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">{e.title}</p>
          <p className="truncate text-xs text-subtle">{e.category.name}</p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', cell: (e) => <span className="font-medium tabular-nums text-strong">{inr(e.amount)}</span> },
    { key: 'date', header: 'Date', cell: (e) => <span className="whitespace-nowrap text-sm text-body">{dayLabel(e.expenseDate)}</span> },
    { key: 'payee', header: 'Vendor / payee', cell: (e) => <span className="text-sm text-body">{e.payee ?? '—'}</span> },
    { key: 'ref', header: 'Reference', cell: (e) => <span className="text-sm text-muted">{e.referenceNumber ?? '—'}</span> },
    {
      key: 'source',
      header: 'Source',
      cell: (e) =>
        e.source === 'WORK_ORDER' ? (
          <Badge tone="info" size="sm">
            <Hammer className="h-3 w-3" /> {e.workOrder?.number ?? 'Work order'}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">Manual</Badge>
        ),
    },
    { key: 'by', header: 'Created by', cell: (e) => <span className="text-sm text-muted">{e.createdByName ?? '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (e) => (
        <div className="flex justify-end gap-2" onClick={(ev) => ev.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => setEditing(e)}>
            {canManage ? 'Edit' : 'View'}
          </Button>
          {canManage && e.source === 'MANUAL' && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete ${e.title}`}
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete "${e.title}"?`,
                  description: `${inr(e.amount)} is removed from the community's expenses. The deletion is kept in the audit log.`,
                  confirmLabel: 'Delete',
                  tone: 'danger',
                });
                if (ok) remove.mutate(e.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const s = summary.data;
  const rows = list.data?.items ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Expenses"
        description="What the community spends, by category. Verified work orders with an actual cost are added automatically."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setManagingCategories(true)}>
                <FolderCog className="h-4 w-4" /> Categories
              </Button>
              <Button onClick={() => setCreating(true)} disabled={!categories.data?.length}>
                <Plus className="h-4 w-4" /> Add expense
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total expenses" value={s ? inr(s.total) : '—'} hint="For the filters below" icon={Wallet} />
        <StatCard label="This month" value={s ? inr(s.currentMonth) : '—'} hint={monthName(s?.currentMonthLabel)} icon={CalendarDays} />
        <StatCard label="Last month" value={s ? inr(s.previousMonth) : '—'} hint={monthName(s?.previousMonthLabel)} icon={CalendarDays} />
        <StatCard label="Expense records" value={s ? s.count.toLocaleString('en-IN') : '—'} hint="For the filters below" icon={Receipt} />
      </div>

      <Card variant="elevated" className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Period" value={period} onChange={(v) => setPeriod(v as PeriodChoice)} options={PERIODS.filter((p) => p.value !== '')} placeholder="All time" />
          <SelectField
            label="Category"
            value={categoryId}
            onChange={setCategoryId}
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="All categories"
          />
          <SelectField
            label="Source"
            value={source}
            onChange={(v) => setSource(v as '' | ExpenseSource)}
            options={[
              { value: 'MANUAL', label: 'Manual' },
              { value: 'WORK_ORDER', label: 'Work order' },
            ]}
            placeholder="All sources"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Search</span>
            <SearchInput value={searchText} onValueChange={setSearchText} placeholder="Title, vendor or reference" className="h-11" />
          </label>
          {period === 'custom' && (
            <>
              <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input
                label="To"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                error={invalidRange ? '“To” must be on or after “From”' : undefined}
              />
            </>
          )}
        </div>
      </Card>

      {list.isError ? (
        <EmptyState title="Could not load expenses" description={(list.error as Error).message} />
      ) : !list.isLoading && rows.length === 0 ? (
        <EmptyState
          title={Object.keys(filters).length > 0 ? 'No expenses match these filters' : 'No expenses recorded yet'}
          description={
            categories.data?.length
              ? 'Expenses you add, and verified work orders with an actual cost, appear here.'
              : 'Start by adding the categories your community spends on — Electricity, Housekeeping, Security…'
          }
          action={
            canManage ? (
              categories.data?.length ? (
                <Button onClick={() => setCreating(true)}>Add an expense</Button>
              ) : (
                <Button onClick={() => setManagingCategories(true)}>Add categories</Button>
              )
            ) : undefined
          }
        />
      ) : (
        <Card variant="elevated" className="p-0">
          <DataTable rows={rows} columns={columns} rowKey={(e) => e.id} loading={list.isLoading} onRowClick={setEditing} />
          {list.data && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3">
              <p className="text-sm text-muted">
                Total for these filters: <span className="font-medium tabular-nums text-strong">{inr(list.data.totalAmount)}</span>
              </p>
              {list.data.meta.totalPages > 1 && <Pagination meta={list.data.meta} onPageChange={setPage} />}
            </div>
          )}
        </Card>
      )}

      {communityId && (
        <ExpenseDrawer
          key={editing?.id ?? (creating ? 'new' : 'closed')}
          communityId={communityId}
          expense={editing}
          categories={categories.data ?? []}
          canManage={canManage}
          open={creating || !!editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {communityId && (
        <CategoriesSheet
          communityId={communityId}
          categories={categories.data ?? []}
          open={managingCategories}
          onClose={() => setManagingCategories(false)}
        />
      )}
    </PageContainer>
  );
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ExpenseDrawer({
  communityId,
  expense,
  categories,
  canManage,
  open,
  onClose,
}: {
  communityId: string;
  expense: Expense | null;
  categories: ExpenseCategory[];
  canManage: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fromWorkOrder = expense?.source === 'WORK_ORDER';
  const readOnly = !canManage;
  const [title, setTitle] = useState(expense?.title ?? '');
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? todayYmd());
  const [payee, setPayee] = useState(expense?.payee ?? '');
  const [referenceNumber, setReferenceNumber] = useState(expense?.referenceNumber ?? '');
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [attachment, setAttachment] = useState<{ key: string; name: string } | null>(
    expense?.attachmentKey ? { key: expense.attachmentKey, name: expense.attachmentName ?? 'Attachment' } : null,
  );
  const [uploading, setUploading] = useState(false);

  const amountNum = Number(amount);
  const errors = {
    title: title.trim().length < 3 ? 'Give the expense a title (3+ characters)' : undefined,
    category: !categoryId ? 'Choose a category' : undefined,
    amount: !(amountNum > 0) ? 'Enter an amount greater than 0' : /\.\d{3,}$/.test(amount) ? 'Up to 2 decimal places' : undefined,
    date: !expenseDate ? 'Choose a date' : expenseDate > todayYmd() ? 'The date cannot be in the future' : undefined,
  };
  const valid = fromWorkOrder ? !errors.category : !Object.values(errors).some(Boolean);

  const save = useMutation({
    mutationFn: () => {
      const bookkeeping = {
        categoryId,
        payee: payee.trim(),
        referenceNumber: referenceNumber.trim(),
        paymentMethod,
        description: description.trim(),
        attachmentKey: attachment?.key ?? '',
        attachmentName: attachment?.name,
      };
      if (fromWorkOrder) return living.expenses.update(communityId, expense!.id, bookkeeping);
      const input = { ...bookkeeping, title: title.trim(), amount: amountNum, expenseDate };
      return expense
        ? living.expenses.update(communityId, expense.id, input)
        : living.expenses.create(communityId, {
            ...input,
            attachmentKey: attachment?.key,
            payee: input.payee || undefined,
            referenceNumber: input.referenceNumber || undefined,
            paymentMethod: input.paymentMethod || undefined,
            description: input.description || undefined,
          });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses', communityId] });
      toast.success(expense ? 'Expense updated' : 'Expense added');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function upload(file: File) {
    setUploading(true);
    try {
      const { key, uploadUrl } = await living.expenses.attachmentUploadUrl(communityId, file.name, file.type || undefined);
      const put = await fetch(uploadUrl, { method: 'PUT', headers: file.type ? { 'content-type': file.type } : {}, body: file });
      if (!put.ok) throw new Error('The upload did not go through — try again');
      setAttachment({ key, name: file.name });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent open={open} title={expense ? (readOnly ? 'Expense' : 'Edit expense') : 'Add an expense'}>
        <div className="space-y-6">
          {fromWorkOrder && (
            <Card variant="outline" className="flex items-start gap-3">
              <Hammer className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <div className="text-sm">
                <p className="font-medium text-strong">From work order {expense?.workOrder?.number}</p>
                <p className="mt-0.5 text-muted">
                  The amount, date and title follow the work order&apos;s verified actual cost. Change the cost on the
                  work order; you can still re-file it under another category here.
                </p>
                {expense?.workOrderId && (
                  <Link to={`/work-orders/${expense.workOrderId}` as string} className="mt-1 inline-block text-brand hover:underline">
                    Open the work order →
                  </Link>
                )}
              </div>
            </Card>
          )}
          {expense?.status === 'REVERSED' && (
            <Card variant="outline" className="text-sm">
              <p className="font-medium text-strong">Reversed — not counted in totals</p>
              <p className="mt-0.5 text-muted">{expense.reversalReason}</p>
            </Card>
          )}

          <FormSection title="Expense">
            <FormGrid>
              <FullWidth>
                <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly || fromWorkOrder} required
                  error={title && errors.title ? errors.title : undefined} placeholder="e.g. BESCOM bill — common areas" />
              </FullWidth>
              <SelectField label="Category" value={categoryId} onChange={setCategoryId} required disabled={readOnly}
                options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose a category…" />
              <Input label="Amount (₹)" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)} disabled={readOnly || fromWorkOrder} required
                error={amount && errors.amount ? errors.amount : undefined} />
              <Input label="Expense date" type="date" max={todayYmd()} value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)} disabled={readOnly || fromWorkOrder} required error={errors.date} />
              <SelectField label="Payment method" value={paymentMethod} onChange={setPaymentMethod} disabled={readOnly}
                options={PAYMENT_METHODS} placeholder="Not recorded" />
            </FormGrid>
          </FormSection>

          <FormSection title="Details" description="Optional, but they make the record easy to find and audit later.">
            <FormGrid>
              <Input label="Vendor / payee" value={payee} onChange={(e) => setPayee(e.target.value)} disabled={readOnly} />
              <Input label="Reference number" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
                disabled={readOnly} placeholder="Invoice / cheque / UTR no." />
              <FullWidth>
                <TextAreaField label="Description" value={description} onChange={readOnly ? () => undefined : setDescription} />
              </FullWidth>
              <FullWidth>
                <div className="flex flex-wrap items-center gap-3">
                  {attachment ? (
                    <span className="inline-flex items-center gap-2 text-sm text-body">
                      <Paperclip className="h-4 w-4 text-subtle" />
                      {expense?.attachmentUrl && attachment.key === expense.attachmentKey ? (
                        <a href={expense.attachmentUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">{attachment.name}</a>
                      ) : (
                        attachment.name
                      )}
                      {!readOnly && (
                        <button type="button" className="text-xs text-subtle hover:text-danger-fg" onClick={() => setAttachment(null)}>Remove</button>
                      )}
                    </span>
                  ) : null}
                  {!readOnly && (
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-control border border-border-subtle bg-card px-3 py-2 text-sm font-medium text-strong hover:bg-sunken focus-within:shadow-ring ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                      <Paperclip className="h-4 w-4" />
                      {uploading ? 'Uploading…' : attachment ? 'Replace invoice' : 'Attach invoice / receipt'}
                      <input type="file" className="sr-only" accept="image/*,application/pdf" disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void upload(file);
                        }} />
                    </label>
                  )}
                </div>
              </FullWidth>
            </FormGrid>
          </FormSection>

          {expense && (
            <p className="text-xs text-subtle">
              Added by {expense.createdByName ?? 'System'} on {new Date(expense.createdAt).toLocaleString('en-IN')}
              {expense.updatedByName && expense.updatedAt !== expense.createdAt
                ? ` · last changed by ${expense.updatedByName} on ${new Date(expense.updatedAt).toLocaleString('en-IN')}`
                : ''}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
            {!readOnly && (
              <Button onClick={() => save.mutate()} disabled={!valid || uploading} loading={save.isPending}>
                {expense ? 'Save changes' : 'Add expense'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The community's own expense heads. A category in use cannot be deleted. */
function CategoriesSheet({
  communityId,
  categories,
  open,
  onClose,
}: {
  communityId: string;
  categories: ExpenseCategory[];
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['expenses', communityId] });
  const create = useMutation({
    mutationFn: () => living.expenses.createCategory(communityId, { name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      void refresh();
      setName('');
      setDescription('');
      toast.success('Category added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const rename = useMutation({
    mutationFn: (c: { id: string; name: string; description?: string | null }) =>
      living.expenses.updateCategory(communityId, c.id, { name: c.name.trim(), description: c.description ?? undefined }),
    onSuccess: () => {
      void refresh();
      setRenaming(null);
      toast.success('Category renamed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => living.expenses.deleteCategory(communityId, id),
    onSuccess: () => {
      void refresh();
      toast.success('Category deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent open={open} title="Expense categories" description="Your community's own expense heads. A category that has expenses can be renamed but not deleted.">
        <div className="space-y-6">
          <FormSection title="Add a category">
            <FormGrid>
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lift maintenance" />
              <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormGrid>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => create.mutate()} disabled={name.trim().length < 2} loading={create.isPending}>
                <Plus className="h-4 w-4" /> Add category
              </Button>
            </div>
          </FormSection>

          <ul className="divide-y divide-border-subtle rounded-control border border-border-subtle">
            {categories.length === 0 && <li className="px-3 py-4 text-sm text-muted">No categories yet.</li>}
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                {renaming?.id === c.id ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <Input label={`Rename ${c.name}`} value={renaming.name} onChange={(e) => setRenaming({ id: c.id, name: e.target.value })} />
                    </div>
                    <Button size="sm" onClick={() => rename.mutate({ id: c.id, name: renaming.name, description: c.description })}
                      disabled={renaming.name.trim().length < 2} loading={rename.isPending}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-strong">
                        {c.name} {c.isSystem && <Badge tone="info" size="sm">Work orders</Badge>}
                      </p>
                      <p className="text-xs text-subtle">
                        {c.expenseCount} expense{c.expenseCount === 1 ? '' : 's'}
                        {c.description ? ` · ${c.description}` : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setRenaming({ id: c.id, name: c.name })}>Rename</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${c.name}`}
                      disabled={c.expenseCount > 0}
                      title={c.expenseCount > 0 ? 'Move or delete its expenses first' : undefined}
                      onClick={async () => {
                        const ok = await confirm({ title: `Delete "${c.name}"?`, confirmLabel: 'Delete', tone: 'danger' });
                        if (ok) remove.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
