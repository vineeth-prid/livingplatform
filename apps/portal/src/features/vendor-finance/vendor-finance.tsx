import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Download, FileText, HandCoins, Percent, Receipt, RefreshCw, Wallet } from 'lucide-react';
import {
  LivingApiError,
  type CommissionModel, type EarningPayoutStatus, type PayoutFrequency, type VendorEarning, type VendorPayout,
} from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, DataTable, EmptyState, Input, LoadingState, PageContainer, PageHeader, PageTransition,
  Sheet, SheetContent, StatCard, printVendorDocument, toast, useConfirm, type Column, type VendorDocumentKind,
} from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';
import { DetailSection } from '../master-data';
import { FormGrid, FullWidth, SelectField, TextAreaField } from '../shared/form-kit';

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const utcDay = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const termsLabel = (m: CommissionModel, rate: number | string | null, fixed?: number | string | null) =>
  m === 'PERCENTAGE' ? `${Number(rate)}%` : m === 'FIXED' ? `${inr(Number(fixed ?? 0))} fixed` : 'No commission';
const freqLabel = (f: PayoutFrequency) => (f === 'WEEKLY' ? 'Weekly' : 'Monthly');
const STATUS_TONE = { UNSETTLED: 'neutral', PENDING: 'warning', PAID: 'success', CANCELLED: 'danger' } as const;
const STATUS_LABEL = { UNSETTLED: 'Not on a statement', PENDING: 'Pending payout', PAID: 'Paid', CANCELLED: 'Cancelled' } as const;
const err = (e: unknown, fallback: string) => toast.error(e instanceof LivingApiError ? e.message : fallback);

function useFinanceAccess() {
  const { hasPermission } = useAuth();
  return { canRead: hasPermission('vendor-finance:read'), canManage: hasPermission('vendor-finance:manage') };
}

// ── Summary ──────────────────────────────────────────────────────────────────

function SummaryCards({ communityId, vendorId }: { communityId: string; vendorId?: string }) {
  const q = useQuery({
    queryKey: ['vendor-finance', communityId, 'summary', vendorId ?? 'all'],
    queryFn: () => living.vendorFinance.summary(communityId, vendorId),
  });
  const s = q.data;
  if (!s) return <LoadingState label="Loading earnings…" />;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Total service value" value={inr(s.totalServiceValue)} icon={Banknote} />
      <StatCard label="Commission deducted" value={inr(s.totalCommission)} icon={Percent} />
      <StatCard label="Vendor payable" value={inr(s.totalPayable)} icon={HandCoins} />
      <StatCard label="Pending payouts" value={inr(s.pendingPayout)} hint={`${s.pendingPayoutCount} statement${s.pendingPayoutCount === 1 ? '' : 's'} open`} icon={Wallet} tone={s.pendingPayout > 0 ? 'warning' : 'default'} />
      <StatCard label="Completed payouts" value={inr(s.paidAmount)} hint={`${s.paidPayoutCount} paid`} icon={Receipt} />
      <StatCard
        label={s.nextPayoutPeriod ? 'Next payout period' : 'Awaiting vendor invoice'}
        value={s.nextPayoutPeriod ? `${utcDay(`${s.nextPayoutPeriod.start}T12:00:00Z`)} – ${utcDay(`${s.nextPayoutPeriod.end}T12:00:00Z`)}` : String(s.awaitingInvoiceCount)}
        hint={s.nextPayoutPeriod ? `${freqLabel(s.nextPayoutPeriod.frequency)} · ${s.awaitingInvoiceCount} awaiting invoice` : 'open statements'}
        icon={FileText}
      />
    </div>
  );
}

// ── Commission terms ─────────────────────────────────────────────────────────

function CommissionTerms({ communityId, vendorId }: { communityId: string; vendorId: string }) {
  const { canManage } = useFinanceAccess();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ['vendor-finance', communityId, 'commission', vendorId],
    queryFn: () => living.vendorFinance.commission(communityId, vendorId),
  });
  const rows = q.data ?? [];
  const current = rows.find((r) => r.isActive && !r.serviceId && new Date(r.effectiveFrom) <= new Date());

  return (
    <DetailSection
      title="Financial configuration"
      action={canManage ? <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Change terms</Button> : undefined}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs text-subtle">Commission</p><p className="font-medium text-strong">{current ? termsLabel(current.model, current.rate, current.fixedAmount) : 'No commission (not set)'}</p></div>
        <div><p className="text-xs text-subtle">Payout frequency</p><p className="font-medium text-strong">{current ? freqLabel(current.payoutFrequency) : 'Monthly (default)'}</p></div>
        <div><p className="text-xs text-subtle">Effective from</p><p className="font-medium text-strong">{current ? utcDay(current.effectiveFrom) : '—'}</p></div>
      </div>
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-subtle"><th className="py-2">Terms</th><th>Applies to</th><th>Frequency</th><th>From</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border-subtle">
                  <td className="py-2 font-medium text-strong">{termsLabel(r.model, r.rate, r.fixedAmount)}</td>
                  <td className="text-body">{r.serviceId ? 'One service' : 'All services'}</td>
                  <td className="text-body">{freqLabel(r.payoutFrequency)}</td>
                  <td className="text-body">{utcDay(r.effectiveFrom)}</td>
                  <td><Badge tone={r.isActive ? 'success' : 'neutral'} size="sm">{r.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="text-right">
                    {canManage && r.isActive && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try {
                          await living.vendorFinance.deactivateCommission(communityId, r.id);
                          void qc.invalidateQueries({ queryKey: ['vendor-finance', communityId] });
                        } catch (e) { err(e, 'Could not deactivate'); }
                      }}>Deactivate</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-subtle">Terms are never edited — a change starts on its own date, so past payouts keep the terms they were calculated with.</p>
        </div>
      ) : (
        <p className="text-sm text-subtle">No terms yet: this vendor's completed services carry no commission and are paid monthly.</p>
      )}
      <TermsForm communityId={communityId} vendorId={vendorId} open={open} onOpenChange={setOpen} />
    </DetailSection>
  );
}

function TermsForm({ communityId, vendorId, open, onOpenChange }: { communityId: string; vendorId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [model, setModel] = useState<CommissionModel>('PERCENTAGE');
  const [rate, setRate] = useState('10');
  const [fixed, setFixed] = useState('');
  const [freq, setFreq] = useState<PayoutFrequency>('MONTHLY');
  const [from, setFrom] = useState(today());
  const save = useMutation({
    mutationFn: () => living.vendorFinance.addCommission(communityId, vendorId, {
      model, payoutFrequency: freq, effectiveFrom: from,
      ...(model === 'PERCENTAGE' ? { rate: Number(rate) } : {}),
      ...(model === 'FIXED' ? { fixedAmount: Number(fixed) } : {}),
    }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['vendor-finance', communityId] }); toast.success('Commission terms saved'); onOpenChange(false); },
    onError: (e) => err(e, 'Could not save the terms'),
  });
  const example = model === 'PERCENTAGE' ? `On ₹10,000: commission ${inr((10000 * Number(rate || 0)) / 100)}, vendor gets ${inr(10000 - (10000 * Number(rate || 0)) / 100)}`
    : model === 'FIXED' ? `On ₹10,000: commission ${inr(Number(fixed || 0))}, vendor gets ${inr(Math.max(0, 10000 - Number(fixed || 0)))}` : 'The vendor receives the full amount.';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} title="Change commission terms" description="Applies to services completed on or after the effective date. Earlier work keeps its terms.">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} className="flex flex-col gap-4">
          <FormGrid>
            <SelectField label="Commission model" required value={model} onChange={(v) => setModel(v as CommissionModel)}
              options={[{ value: 'PERCENTAGE', label: 'Percentage of service amount' }, { value: 'FIXED', label: 'Fixed amount per service' }, { value: 'NONE', label: 'No commission' }]} />
            {model === 'PERCENTAGE' && <Input label="Commission %" type="number" min={0} max={100} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required />}
            {model === 'FIXED' && <Input label="Fixed commission (₹ per service)" type="number" min={0} step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} required />}
            <SelectField label="Payout frequency" required value={freq} onChange={(v) => setFreq(v as PayoutFrequency)}
              options={[{ value: 'WEEKLY', label: 'Weekly (Mon–Sun)' }, { value: 'MONTHLY', label: 'Monthly (calendar month)' }]} />
            <Input label="Effective from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
            <FullWidth><p className="rounded-control bg-sunken px-3 py-2 text-sm text-body">{example}</p></FullWidth>
          </FormGrid>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save terms</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Earnings & payouts tables ────────────────────────────────────────────────

function EarningsTable({ rows, showVendor }: { rows: VendorEarning[]; showVendor: boolean }) {
  const columns: Column<VendorEarning>[] = [
    { key: 'ref', header: 'Service', cell: (r) => <div className="min-w-0"><p className="font-medium text-strong">{r.displayNumber}</p><p className="truncate text-xs text-subtle">{r.serviceName}{r.unitNumber ? ` · ${r.unitNumber}` : ''}</p></div> },
    ...(showVendor ? [{ key: 'vendor', header: 'Vendor', cell: (r: VendorEarning) => <span className="text-sm text-body">{r.vendorName}</span> }] : []),
    { key: 'date', header: 'Completed', cell: (r) => <span className="text-sm text-body">{day(r.completedAt)}</span> },
    { key: 'value', header: 'Service amount', align: 'right', cell: (r) => <span className="text-sm text-strong" data-numeric title={r.basis === 'PACKAGE' ? 'Package visit — catalogue price' : 'Paid less refunds'}>{inr(r.serviceValue)}{r.basis === 'PACKAGE' ? ' ·P' : ''}</span> },
    { key: 'model', header: 'Commission', cell: (r) => <span className="text-xs text-muted">{termsLabel(r.commissionModel, r.commissionRate, r.commissionModel === 'FIXED' ? r.commission : null)}</span> },
    { key: 'commission', header: 'Deducted', align: 'right', cell: (r) => <span className="text-sm text-body" data-numeric>{inr(r.commission)}</span> },
    { key: 'payable', header: 'Vendor payable', align: 'right', cell: (r) => <span className="text-sm font-medium text-strong" data-numeric>{inr(r.payable)}</span> },
    { key: 'status', header: 'Payout', cell: (r) => <div><Badge tone={STATUS_TONE[r.payoutStatus]} size="sm">{STATUS_LABEL[r.payoutStatus]}</Badge>{r.payoutNumber && <p className="mt-0.5 font-mono text-2xs text-subtle">{r.payoutNumber}</p>}</div> },
  ];
  if (rows.length === 0) return <EmptyState title="No vendor earnings" description="Completed, paid service requests (and package visits) assigned to a vendor appear here." />;
  return <Card variant="elevated" className="p-0"><DataTable rows={rows} rowKey={(r) => r.serviceRequestId} columns={columns} /></Card>;
}

function PayoutsTable({ payouts, showVendor, onOpen }: { payouts: VendorPayout[]; showVendor: boolean; onOpen: (id: string) => void }) {
  const columns: Column<VendorPayout>[] = [
    { key: 'no', header: 'Statement', cell: (p) => <button type="button" onClick={() => onOpen(p.id)} className="text-left"><p className="font-mono text-sm font-medium text-brand hover:underline">{p.number}</p><p className="text-xs text-subtle">{freqLabel(p.frequency)} · {p.lineCount ?? 0} services</p></button> },
    ...(showVendor ? [{ key: 'vendor', header: 'Vendor', cell: (p: VendorPayout) => <span className="text-sm text-body">{p.vendor?.companyName || p.vendor?.name}</span> }] : []),
    { key: 'period', header: 'Period', cell: (p) => <span className="text-sm text-body">{utcDay(p.periodStart)} – {utcDay(p.periodEnd)}</span> },
    { key: 'value', header: 'Service value', align: 'right', cell: (p) => <span className="text-sm" data-numeric>{inr(p.serviceValue)}</span> },
    { key: 'commission', header: 'Commission', align: 'right', cell: (p) => <span className="text-sm" data-numeric>{inr(p.commission)}</span> },
    { key: 'payable', header: 'Net payout', align: 'right', cell: (p) => <span className="text-sm font-medium text-strong" data-numeric>{inr(p.payable)}</span> },
    { key: 'status', header: 'Status', cell: (p) => <div><Badge tone={STATUS_TONE[p.status]} size="sm" dot>{STATUS_LABEL[p.status]}</Badge>{p.status === 'PENDING' && !p.vendorInvoiceNumber && <p className="mt-0.5 text-2xs text-warning-fg">Invoice awaited</p>}</div> },
    { key: 'paid', header: 'Paid on', cell: (p) => <div className="text-sm text-body">{p.paidAt ? day(p.paidAt) : '—'}{p.paymentReference && <p className="font-mono text-2xs text-subtle">{p.paymentReference}</p>}</div> },
  ];
  if (payouts.length === 0) return <EmptyState title="No payout statements yet" description="Generate statements once a weekly or monthly period has closed." />;
  return <Card variant="elevated" className="p-0"><DataTable rows={payouts} rowKey={(p) => p.id} columns={columns} /></Card>;
}

// ── Payout detail: documents, invoice, record payment, cancel ────────────────

function PayoutSheet({ communityId, payoutId, onOpenChange }: { communityId: string; payoutId: string | null; onOpenChange: (o: boolean) => void }) {
  const { canManage } = useFinanceAccess();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const open = !!payoutId;
  const q = useQuery({
    queryKey: ['vendor-finance', communityId, 'payout', payoutId],
    queryFn: () => living.vendorFinance.payout(communityId, payoutId!),
    enabled: open,
  });
  const p = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['vendor-finance', communityId] });

  const [paidAt, setPaidAt] = useState(today());
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('NEFT');
  const [notes, setNotes] = useState('');
  const pay = useMutation({
    mutationFn: () => living.vendorFinance.markPaid(communityId, p!.id, { amount: p!.payable, paidAt, reference, method, notes: notes || undefined }),
    onSuccess: () => { void refresh(); toast.success('Payout recorded as paid'); setReference(''); setNotes(''); },
    onError: (e) => err(e, 'Could not record the payment'),
  });

  const [invoiceNo, setInvoiceNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const invoice = useMutation({
    mutationFn: async () => {
      let key: string | undefined;
      if (file) {
        const up = await living.vendorFinance.invoiceUploadUrl(communityId, p!.id, file.name, file.type || undefined);
        const put = await fetch(up.uploadUrl, { method: 'PUT', headers: file.type ? { 'content-type': file.type } : {}, body: file });
        if (!put.ok) throw new Error('The invoice file did not upload — try again');
        key = up.key;
      }
      return living.vendorFinance.setInvoice(communityId, p!.id, invoiceNo.trim(), key);
    },
    onSuccess: () => { void refresh(); toast.success('Vendor invoice recorded'); setInvoiceNo(''); setFile(null); },
    onError: (e) => err(e, 'Could not record the invoice'),
  });

  function doc(kind: VendorDocumentKind) {
    if (p && !printVendorDocument(p, kind)) toast.error('Allow pop-ups to download the document');
  }
  async function onCancel() {
    if (!p) return;
    const ok = await confirm({ title: `Cancel ${p.number}?`, description: 'Its services go back to “not on a statement” and will be picked up by the next statement.', confirmLabel: 'Cancel statement', tone: 'danger' });
    if (!ok) return;
    try { await living.vendorFinance.cancel(communityId, p.id, 'Cancelled by admin'); void refresh(); toast.success('Statement cancelled'); onOpenChange(false); }
    catch (e) { err(e, 'Could not cancel'); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} title={p ? `Payout ${p.number}` : 'Payout'} description={p ? `${p.vendor.companyName || p.vendor.name} · ${utcDay(p.periodStart)} – ${utcDay(p.periodEnd)} (${freqLabel(p.frequency).toLowerCase()})` : undefined}>
        {!p ? <LoadingState /> : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Service value" value={inr(p.serviceValue)} />
              <StatCard label="Commission" value={inr(p.commission)} />
              <StatCard label="Net payable" value={inr(p.payable)} />
              <StatCard label="Status" value={STATUS_LABEL[p.status]} hint={p.paidAt ? `Paid ${day(p.paidAt)}${p.paidByName ? ` · by ${p.paidByName}` : ''}` : p.cancelReason ?? undefined} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => doc('statement')}><Download className="h-4 w-4" /> Payout statement</Button>
              <Button size="sm" variant="secondary" onClick={() => doc('commission')}><Download className="h-4 w-4" /> Commission statement</Button>
              {p.status === 'PAID' && <Button size="sm" variant="secondary" onClick={() => doc('receipt')}><Download className="h-4 w-4" /> Payment receipt</Button>}
              {p.vendorInvoiceKey && (
                <Button size="sm" variant="ghost" onClick={async () => {
                  try { const { url } = await living.vendorFinance.invoice(communityId, p.id); if (url) window.open(url, '_blank', 'noopener'); }
                  catch (e) { err(e, 'Could not open the invoice'); }
                }}><FileText className="h-4 w-4" /> Vendor invoice {p.vendorInvoiceNumber}</Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-card border border-border-subtle">
              <table className="w-full text-sm">
                <thead className="bg-sunken text-left text-xs uppercase tracking-wider text-subtle">
                  <tr><th className="px-3 py-2">Service</th><th className="px-3">Completed</th><th className="px-3 text-right">Amount</th><th className="px-3">Terms</th><th className="px-3 text-right">Commission</th><th className="px-3 text-right">Payable</th></tr>
                </thead>
                <tbody>
                  {p.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border-subtle">
                      <td className="px-3 py-2"><p className="font-medium text-strong">{l.displayNumber}</p><p className="text-xs text-subtle">{l.serviceName}{l.unitNumber ? ` · ${l.unitNumber}` : ''}</p></td>
                      <td className="px-3 text-body">{day(l.completedAt)}</td>
                      <td className="px-3 text-right" data-numeric>{inr(l.serviceValue)}</td>
                      <td className="px-3 text-xs text-muted">{termsLabel(l.commissionModel, l.commissionRate, l.commissionModel === 'FIXED' ? l.commission : null)}</td>
                      <td className="px-3 text-right" data-numeric>{inr(l.commission)}</td>
                      <td className="px-3 text-right font-medium text-strong" data-numeric>{inr(l.payable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManage && p.status !== 'CANCELLED' && (
              <form onSubmit={(e) => { e.preventDefault(); if (invoiceNo.trim()) invoice.mutate(); }} className="rounded-card border border-border-subtle p-4">
                <h3 className="mb-3 text-sm font-semibold text-strong">Vendor invoice {p.vendorInvoiceNumber && <span className="font-normal text-muted">· recorded: {p.vendorInvoiceNumber}</span>}</h3>
                <FormGrid>
                  <Input label="Invoice number" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Vendor's invoice no." />
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-strong">Invoice file (optional)
                    <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-body" />
                  </label>
                </FormGrid>
                <div className="mt-3 flex justify-end"><Button type="button" variant="secondary" size="sm" loading={invoice.isPending} disabled={!invoiceNo.trim()} onClick={() => invoice.mutate()}>Save invoice</Button></div>
              </form>
            )}

            {canManage && p.status === 'PENDING' && (
              <form onSubmit={(e) => { e.preventDefault(); pay.mutate(); }} className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-strong">Record payment of {inr(p.payable)}</h3>
                <FormGrid>
                  <Input label="Payment date" type="date" value={paidAt} max={today()} onChange={(e) => setPaidAt(e.target.value)} required />
                  <SelectField label="Method" value={method} onChange={setMethod} options={['NEFT', 'IMPS', 'RTGS', 'UPI', 'CHEQUE', 'CASH'].map((m) => ({ value: m, label: m }))} />
                  <FullWidth><Input label="Transaction reference (UTR / cheque no.)" value={reference} onChange={(e) => setReference(e.target.value)} required /></FullWidth>
                  <FullWidth><TextAreaField label="Notes" value={notes} onChange={setNotes} rows={2} /></FullWidth>
                </FormGrid>
                <div className="flex justify-between gap-3">
                  <Button type="button" variant="ghost" onClick={() => void onCancel()}>Cancel statement</Button>
                  <Button type="submit" loading={pay.isPending} disabled={!reference.trim()}>Mark {inr(p.payable)} as paid</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Earnings + payouts with filters (one vendor or all) ──────────────────────

function FinanceWorkspace({ communityId, vendorId }: { communityId: string; vendorId?: string }) {
  const { canManage } = useFinanceAccess();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'transactions' | 'payouts'>('transactions');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<EarningPayoutStatus | ''>('');
  const [frequency, setFrequency] = useState<PayoutFrequency | ''>('');
  const [vendor, setVendor] = useState('');
  const [service, setService] = useState('');
  const [openPayout, setOpenPayout] = useState<string | null>(null);
  const vId = vendorId ?? (vendor || undefined);

  const earnings = useQuery({
    queryKey: ['vendor-finance', communityId, 'transactions', vId, from, to, status, frequency],
    queryFn: () => living.vendorFinance.transactions(communityId, {
      vendorId: vId, from: from || undefined, to: to || undefined, payoutStatus: status || undefined, frequency: frequency || undefined,
    }),
  });
  const payouts = useQuery({
    queryKey: ['vendor-finance', communityId, 'payouts', vId, from, to, frequency],
    queryFn: () => living.vendorFinance.payouts(communityId, { vendorId: vId, from: from || undefined, to: to || undefined, frequency: frequency || undefined }),
  });
  const allRows = earnings.data ?? [];
  const vendorOptions = useMemo(() => [...new Map(allRows.map((r) => [r.vendorId, r.vendorName])).entries()].map(([value, label]) => ({ value, label })), [allRows]);
  const serviceOptions = useMemo(() => [...new Map(allRows.map((r) => [r.serviceId, r.serviceName])).entries()].map(([value, label]) => ({ value, label })), [allRows]);
  const rows = service ? allRows.filter((r) => r.serviceId === service) : allRows;
  const payoutRows = (payouts.data ?? []).filter((p) => !status || (status !== 'UNSETTLED' && p.status === status));

  const generate = useMutation({
    mutationFn: () => living.vendorFinance.generate(communityId, vendorId),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ['vendor-finance', communityId] }); toast.success(r.created ? `${r.created} payout statement${r.created === 1 ? '' : 's'} created` : 'Nothing to settle — no closed period has unsettled work'); },
    onError: (e) => err(e, 'Could not generate statements'),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="inline-flex rounded-control border border-border p-0.5">
          {(['transactions', 'payouts'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 text-sm ${tab === t ? 'bg-brand text-brand-fg' : 'text-body hover:bg-sunken'}`}>
              {t === 'transactions' ? 'Transactions' : 'Payout statements'}
            </button>
          ))}
        </div>
        {canManage && (
          <Button variant="secondary" loading={generate.isPending} onClick={() => generate.mutate()}>
            <RefreshCw className="h-4 w-4" /> Generate statements for closed periods
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {!vendorId && <SelectField label="Vendor" value={vendor} onChange={setVendor} options={vendorOptions} placeholder="All vendors" />}
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <SelectField label="Payout period" value={frequency} onChange={(v) => setFrequency(v as PayoutFrequency | '')} options={[{ value: 'WEEKLY', label: 'Weekly' }, { value: 'MONTHLY', label: 'Monthly' }]} placeholder="Weekly & monthly" />
        <SelectField label="Service" value={service} onChange={setService} options={serviceOptions} placeholder="All services" />
        <SelectField label="Payout status" value={status} onChange={(v) => setStatus(v as EarningPayoutStatus | '')}
          options={[{ value: 'UNSETTLED', label: 'Not on a statement' }, { value: 'PENDING', label: 'Pending payout' }, { value: 'PAID', label: 'Paid' }]} placeholder="Any status" />
      </div>
      {tab === 'transactions'
        ? (earnings.isLoading ? <LoadingState label="Loading transactions…" /> : <EarningsTable rows={rows} showVendor={!vendorId} />)
        : (payouts.isLoading ? <LoadingState label="Loading payouts…" /> : <PayoutsTable payouts={payoutRows} showVendor={!vendorId} onOpen={setOpenPayout} />)}
      <PayoutSheet communityId={communityId} payoutId={openPayout} onOpenChange={(o) => !o && setOpenPayout(null)} />
    </div>
  );
}

/** The Financial section of a vendor's detail page. */
export function VendorFinancePanel({ vendorId }: { vendorId: string }) {
  const { communityId } = useCommunity();
  const { canRead } = useFinanceAccess();
  if (!communityId || !canRead) return null;
  return (
    <div className="flex flex-col gap-6">
      <CommissionTerms communityId={communityId} vendorId={vendorId} />
      <DetailSection title="Earnings & payouts">
        <div className="flex flex-col gap-6">
          <SummaryCards communityId={communityId} vendorId={vendorId} />
          <FinanceWorkspace communityId={communityId} vendorId={vendorId} />
        </div>
      </DetailSection>
    </div>
  );
}

/** Vendor Management → Payouts: every vendor's earnings, statements and settlements. */
export function VendorPayoutsPage() {
  const { communityId } = useCommunity();
  return (
    <PageTransition>
      <PageContainer>
        <PageHeader eyebrow="Vendor management" title="Vendor payouts"
          description="Commission retained and amounts owed to each vendor, grouped into weekly or monthly payout statements. Payments are recorded here once transferred — Living does not move money itself." />
        {communityId ? (
          <div className="flex flex-col gap-6">
            <SummaryCards communityId={communityId} />
            <FinanceWorkspace communityId={communityId} />
          </div>
        ) : <LoadingState />}
      </PageContainer>
    </PageTransition>
  );
}
