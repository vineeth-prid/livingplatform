import { useState } from 'react';
import { Banknote, FileText, Play, TrendingUp, Wallet } from 'lucide-react';
import type { BillingCycle, MaintenanceInvoice } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, DataTable, Dialog, DialogContent, EmptyState, Input, LoadingState,
  PageContainer, PageHeader, Pagination, StatCard, toast, type Column,
} from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';
import { Tabs } from '../shared/tabs';
import { FormGrid, SelectField } from '../shared/form-kit';
import {
  inr, useBillingMutation, useCollectionSummary, useInvoices, usePaymentsHistory,
  usePaymentStatusByUnit,
} from './queries';

const CYCLES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const INVOICE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  PAID: 'success',
  ISSUED: 'info',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
  DRAFT: 'neutral',
};

/**
 * Feature 4 — the Community Admin collection view: what was billed, what came
 * in, what is still outstanding, and the per-resident detail behind it.
 */
export function CollectionDashboardPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const summary = useCollectionSummary(communityId, 6);
  const [tab, setTab] = useState<'invoices' | 'residents' | 'transactions'>('invoices');
  const [generating, setGenerating] = useState(false);

  if (summary.isLoading || !summary.data) return <LoadingState label="Loading collection…" />;
  const s = summary.data;

  return (
    <PageContainer>
      <PageHeader
        title="Maintenance collection"
        description="Billing, collection and outstanding dues across the community."
        actions={
          hasPermission('billing:invoice:generate') ? (
            <Button onClick={() => setGenerating(true)}>
              <Play className="h-4 w-4" /> Generate invoices
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding" value={inr(s.outstanding)} icon={Wallet} tone="warning" />
        <StatCard label="Collected" value={inr(s.collected)} icon={Banknote} tone="success" />
        <StatCard label="Billed" value={inr(s.billed)} icon={FileText} />
        <StatCard
          label="Collection rate"
          value={`${s.collectionRate}%`}
          icon={TrendingUp}
          hint={`${s.invoiceCount} invoices · ${s.unitCount} units`}
        />
      </div>

      <Card variant="elevated" className="mb-6">
        <h2 className="mb-4 font-display text-h4 tracking-tight text-strong">Monthly collection</h2>
        <CollectionBars data={s.monthlyCollection} />
      </Card>

      <Tabs
        active={tab}
        onChange={(v) => setTab(v as typeof tab)}
        tabs={[
          { key: 'invoices', label: 'Invoices' },
          { key: 'residents', label: 'Residents' },
          { key: 'transactions', label: 'Transactions' },
        ]}
      />

      <div className="mt-4">
        {tab === 'invoices' && <InvoicesTable />}
        {tab === 'residents' && <ResidentsTable />}
        {tab === 'transactions' && <TransactionsTable />}
      </div>

      {communityId && (
        <GenerateDialog
          communityId={communityId}
          open={generating}
          onClose={() => setGenerating(false)}
        />
      )}
    </PageContainer>
  );
}

/** Hand-rolled SVG bars — same approach as the Platform Admin charts. */
function CollectionBars({ data }: { data: Array<{ month: string; amount: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  return (
    <div className="flex items-end gap-3" style={{ height: 160 }}>
      {data.map((d) => {
        const height = Math.max(2, Math.round((d.amount / max) * 130));
        return (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-2xs tabular-nums text-subtle">
              {d.amount > 0 ? inr(d.amount) : ''}
            </span>
            <div
              className="w-full rounded-t-sm bg-brand transition-[height] duration-500"
              style={{ height }}
              role="img"
              aria-label={`${d.month}: ${inr(d.amount)}`}
            />
            <span className="text-2xs text-subtle">{d.month.slice(5)}/{d.month.slice(2, 4)}</span>
          </div>
        );
      })}
    </div>
  );
}

function InvoicesTable() {
  const { communityId } = useCommunity();
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const invoices = useInvoices(communityId, {
    limit: 50,
    sortBy: 'dueDate',
    sortDir: 'desc',
    ...(outstandingOnly ? { outstandingOnly: true } : {}),
  });
  const [collecting, setCollecting] = useState<MaintenanceInvoice | null>(null);

  const columns: Column<MaintenanceInvoice>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      cell: (i) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">{i.invoiceNumber}</p>
          <p className="text-xs text-subtle">
            {new Date(i.periodStart).toLocaleDateString()} – {new Date(i.periodEnd).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      cell: (i) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-body">{i.unitNumber ?? '—'}</p>
          {i.residentName && <p className="truncate text-xs text-subtle">{i.residentName}</p>}
        </div>
      ),
    },
    { key: 'total', header: 'Total', cell: (i) => <span className="text-sm font-medium text-strong">{inr(i.totalAmount)}</span> },
    { key: 'paid', header: 'Paid', cell: (i) => <span className="text-sm text-body">{inr(i.paidAmount)}</span> },
    {
      key: 'balance',
      header: 'Balance',
      cell: (i) => (
        <span className={`text-sm font-medium ${i.balance > 0 ? 'text-warning-fg' : 'text-muted'}`}>
          {inr(i.balance)}
        </span>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      cell: (i) => (
        <span className="text-sm text-body">
          {new Date(i.dueDate).toLocaleDateString()}
          {i.daysOverdue > 0 && (
            <span className="block text-xs text-danger-fg">{i.daysOverdue} days overdue</span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (i) => (
        <Badge tone={INVOICE_TONE[i.status] ?? 'neutral'} size="sm" dot>
          {i.status.replace(/_/g, ' ').toLowerCase()}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) =>
        i.balance > 0 && i.status !== 'CANCELLED' ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" onClick={() => setCollecting(i)}>
              Record payment
            </Button>
          </div>
        ) : null,
    },
  ];

  const rows = invoices.data?.items ?? [];

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          size="sm"
          variant={outstandingOnly ? 'primary' : 'secondary'}
          onClick={() => setOutstandingOnly((v) => !v)}
        >
          Outstanding only
        </Button>
      </div>
      {invoices.isLoading ? (
        <LoadingState label="Loading invoices…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Generate a billing run once maintenance charges are configured."
        />
      ) : (
        <Card variant="elevated" className="p-0">
          <DataTable rows={rows} columns={columns} rowKey={(i) => i.id} />
        </Card>
      )}
      {communityId && collecting && (
        <RecordPaymentDialog
          communityId={communityId}
          invoice={collecting}
          onClose={() => setCollecting(null)}
        />
      )}
    </>
  );
}

/** One row per unit: who lives there, what they were billed, what is outstanding.
 *  Sorted by amount billed, so the largest exposures surface first. */
interface UnitStandingRow {
  unitId: string;
  unitNumber: string | null;
  propertyType: string | null;
  residentId: string | null;
  residentName: string | null;
  residentMobile: string | null;
  invoiceCount: number;
  billed: number;
  collected: number;
  outstanding: number;
}

function ResidentsTable() {
  const { communityId } = useCommunity();
  const [page, setPage] = useState(1);
  const standing = usePaymentStatusByUnit(communityId, { page, limit: 25 });
  const rows = (standing.data?.items ?? []) as unknown as UnitStandingRow[];
  const meta = standing.data?.meta;

  const columns: Column<UnitStandingRow>[] = [
    {
      key: 'unit',
      header: 'Unit',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">{r.unitNumber ?? '—'}</p>
          {r.propertyType && <p className="text-xs text-subtle">{r.propertyType}</p>}
        </div>
      ),
    },
    {
      key: 'resident',
      header: 'Resident',
      cell: (r) =>
        r.residentName ? (
          <div className="min-w-0">
            <p className="truncate text-sm text-body">{r.residentName}</p>
            {r.residentMobile && (
              <p className="truncate font-mono text-xs text-subtle">{r.residentMobile}</p>
            )}
          </div>
        ) : (
          <span className="text-sm text-subtle">Unoccupied</span>
        ),
    },
    {
      key: 'invoices',
      header: 'Invoices',
      cell: (r) => <span className="text-sm text-muted">{r.invoiceCount}</span>,
    },
    { key: 'billed', header: 'Billed', cell: (r) => <span className="text-sm text-body">{inr(r.billed)}</span> },
    {
      key: 'collected',
      header: 'Collected',
      cell: (r) => <span className="text-sm text-body">{inr(r.collected)}</span>,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      cell: (r) => (
        <span
          className={`text-sm font-medium ${r.outstanding > 0 ? 'text-warning-fg' : 'text-success-fg'}`}
        >
          {inr(r.outstanding)}
        </span>
      ),
    },
    {
      key: 'status',
      header: '',
      align: 'right',
      cell: (r) =>
        r.outstanding > 0 ? (
          <Badge tone="warning" size="sm" dot>
            due
          </Badge>
        ) : (
          <Badge tone="success" size="sm" dot>
            settled
          </Badge>
        ),
    },
  ];

  if (standing.isLoading) return <LoadingState label="Loading payment status…" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing billed yet"
        description="Once invoices are generated, each unit's payment standing appears here."
      />
    );
  }

  return (
    <>
      <Card variant="elevated" className="p-0">
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.unitId} />
      </Card>
      {meta && meta.totalPages > 1 && <Pagination meta={meta} onPageChange={setPage} />}
    </>
  );
}

function TransactionsTable() {
  const { communityId } = useCommunity();
  const payments = usePaymentsHistory(communityId, { limit: 50, sortBy: 'createdAt', sortDir: 'desc' });
  const rows = payments.data?.items ?? [];

  if (payments.isLoading) return <LoadingState label="Loading transactions…" />;
  if (rows.length === 0) {
    return <EmptyState title="No transactions yet" description="Payments appear here as residents pay." />;
  }

  return (
    <Card variant="elevated" className="p-0">
      <DataTable
        rows={rows}
        rowKey={(p) => p.id}
        columns={[
          {
            key: 'receipt',
            header: 'Receipt',
            cell: (p) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-strong">{p.receiptNumber ?? '—'}</p>
                <p className="text-xs text-subtle">{new Date(p.createdAt).toLocaleString()}</p>
              </div>
            ),
          },
          { key: 'purpose', header: 'Rail', cell: (p) => <Badge tone="neutral" size="sm">{p.purpose.toLowerCase()}</Badge> },
          { key: 'invoice', header: 'Invoice', cell: (p) => <span className="text-sm text-body">{p.invoiceNumber ?? '—'}</span> },
          { key: 'amount', header: 'Amount', cell: (p) => <span className="text-sm font-medium text-strong">{inr(p.amount)}</span> },
          { key: 'method', header: 'Method', cell: (p) => <span className="text-sm text-body">{p.method ?? p.gateway}</span> },
          {
            key: 'status',
            header: 'Status',
            cell: (p) => (
              <Badge
                tone={p.status === 'PAID' ? 'success' : p.status === 'FAILED' ? 'danger' : 'neutral'}
                size="sm"
                dot
              >
                {p.status.toLowerCase()}
              </Badge>
            ),
          },
        ]}
      />
    </Card>
  );
}

function GenerateDialog({
  communityId,
  open,
  onClose,
}: {
  communityId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [periodDate, setPeriodDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDay, setDueDay] = useState('10');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof living.billing.generate>> | null>(
    null,
  );
  const run = useBillingMutation(communityId, (cid, input: Record<string, unknown>) =>
    living.billing.generate(cid, input),
  );

  async function go(dryRun: boolean) {
    try {
      const result = await run.mutateAsync({
        cycle,
        periodDate: new Date(periodDate).toISOString(),
        dueDay: Number(dueDay),
        dryRun,
      });
      setPreview(result);
      if (!dryRun) {
        toast.success(`${result.created} invoices generated`);
        onClose();
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        open={open}
        title="Generate maintenance invoices"
        description="Re-running a period is safe — units already billed for it are skipped."
      >
        <FormGrid>
          <SelectField label="Cycle" value={cycle} onChange={(v) => setCycle(v as BillingCycle)} options={CYCLES} />
          <Input
            label="Any date in the period"
            type="date"
            value={periodDate}
            onChange={(e) => setPeriodDate(e.target.value)}
          />
          <Input
            label="Due day of month"
            type="number"
            inputMode="numeric"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
        </FormGrid>

        {preview && (
          <div className="mt-4 rounded-control bg-sunken px-3 py-2 text-sm">
            <p className="text-strong">
              {preview.created} to bill · {preview.skipped} already billed · {preview.unpriced} without
              a rate
            </p>
            <p className="text-muted">Total {inr(preview.totalBilled)}</p>
            {preview.missingRates.length > 0 && (
              <p className="mt-1 text-warning-fg">
                No rate configured for: {preview.missingRates.join(', ')}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => void go(true)} loading={run.isPending}>
            Preview
          </Button>
          <Button onClick={() => void go(false)} loading={run.isPending}>
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  communityId,
  invoice,
  onClose,
}: {
  communityId: string;
  invoice: MaintenanceInvoice;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(invoice.balance));
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const record = useBillingMutation(communityId, (cid, input: Record<string, unknown>) =>
    living.billing.recordPayment(cid, invoice.id, input as { amount: number }),
  );

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        open
        title={`Record a payment for ${invoice.invoiceNumber}`}
        description={`Balance ${inr(invoice.balance)} · Unit ${invoice.unitNumber ?? '—'}`}
      >
        <FormGrid>
          <Input
            label="Amount received (₹)"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <SelectField
            label="Method"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'cheque', label: 'Cheque' },
              { value: 'neft', label: 'NEFT / IMPS' },
              { value: 'upi', label: 'UPI' },
            ]}
          />
          <Input
            label="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Cheque no. / UTR"
          />
        </FormGrid>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={record.isPending}
            onClick={async () => {
              try {
                await record.mutateAsync({ amount: Number(amount), method, reference: reference || undefined });
                toast.success('Payment recorded');
                onClose();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            Record payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
