import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Wallet } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { Badge, Button, Card, EmptyState, Skeleton, printVendorDocument, toast } from '@living/ui';

import { Section } from '../components';
import { living } from '../lib/living';
import { ScreenHeader } from '../shell';
import { useWorker } from '../worker';

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');
const utcDay = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const STATUS = {
  UNSETTLED: { label: 'Earned', tone: 'neutral' },
  PENDING: { label: 'Payout pending', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
} as const;

/** My Earnings — a vendor's own figures only (the API scopes it to their vendor record). */
export function EarningsScreen() {
  const { communityId } = useWorker();
  const [tab, setTab] = useState<'transactions' | 'payouts'>('transactions');
  const q = useQuery({
    queryKey: ['vendor-finance', communityId, 'me'],
    queryFn: () => living.vendorFinance.mine(communityId!),
    enabled: !!communityId,
  });

  async function download(id: string, kind: 'statement' | 'receipt') {
    try {
      const detail = await living.vendorFinance.myPayout(communityId!, id);
      if (!printVendorDocument(detail, kind)) toast.error('Allow pop-ups to download');
    } catch (e) {
      toast.error(e instanceof LivingApiError ? e.message : 'Could not open the document');
    }
  }

  const s = q.data?.summary;
  return (
    <div>
      <ScreenHeader title="My earnings" subtitle="Payments" />
      <div className="px-4">
        {!s ? (
          <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total earnings" value={inr(s.totalPayable)} />
              <Stat label="Pending payout" value={inr(s.pendingPayout)} tone="warning" />
              <Stat label="Paid to you" value={inr(s.paidAmount)} tone="success" />
              <Stat label="Commission deducted" value={inr(s.totalCommission)} />
            </div>
            {s.nextPayoutPeriod && (
              <p className="mt-3 text-xs text-muted">
                Paid {s.nextPayoutPeriod.frequency === 'WEEKLY' ? 'weekly' : 'monthly'} · current period{' '}
                {utcDay(`${s.nextPayoutPeriod.start}T12:00:00Z`)} – {utcDay(`${s.nextPayoutPeriod.end}T12:00:00Z`)}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 rounded-control bg-sunken p-1">
              {(['transactions', 'payouts'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`rounded-[calc(var(--radius-control)-4px)] py-2 text-sm font-medium ${tab === t ? 'bg-raised text-strong shadow-sm' : 'text-muted'}`}>
                  {t === 'transactions' ? 'Transactions' : 'Payouts'}
                </button>
              ))}
            </div>

            {tab === 'transactions' ? (
              <Section title="Completed services">
                {q.data!.transactions.length === 0 ? (
                  <EmptyState icon={Wallet} title="No earnings yet" description="Completed, paid jobs appear here with your net amount." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {q.data!.transactions.map((t) => (
                      <Card key={t.serviceRequestId} variant="elevated" className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-strong">{t.serviceName}</p>
                          <p className="text-xs text-subtle">{t.displayNumber} · {day(t.completedAt)} · period {utcDay(`${t.period.start}T12:00:00Z`)}–{utcDay(`${t.period.end}T12:00:00Z`)}</p>
                          <p className="mt-1 text-xs text-muted">{inr(t.serviceValue)} − {inr(t.commission)} commission</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-strong" data-numeric>{inr(t.payable)}</p>
                          <Badge tone={STATUS[t.payoutStatus].tone} size="sm">{STATUS[t.payoutStatus].label}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Section>
            ) : (
              <Section title="Payout history">
                {q.data!.payouts.length === 0 ? (
                  <EmptyState icon={Wallet} title="No payouts yet" description="Your weekly or monthly payout statements appear here." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {q.data!.payouts.map((p) => (
                      <Card key={p.id} variant="elevated">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-strong">{utcDay(p.periodStart)} – {utcDay(p.periodEnd)}</p>
                            <p className="text-xs text-subtle">{p.number} · {p.frequency === 'WEEKLY' ? 'Weekly' : 'Monthly'}</p>
                            <p className="mt-1 text-xs text-muted">{inr(p.serviceValue)} − {inr(p.commission)} commission</p>
                            {p.paidAt && <p className="text-xs text-muted">Paid {day(p.paidAt)}{p.paymentReference ? ` · ref ${p.paymentReference}` : ''}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-strong" data-numeric>{inr(p.payable)}</p>
                            <Badge tone={STATUS[p.status].tone} size="sm">{STATUS[p.status].label}</Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => void download(p.id, 'statement')}><Download className="h-3.5 w-3.5" /> Statement</Button>
                          {p.status === 'PAID' && <Button size="sm" variant="ghost" onClick={() => void download(p.id, 'receipt')}><Download className="h-3.5 w-3.5" /> Receipt</Button>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'success' }) {
  return (
    <Card variant="elevated" className="min-w-0">
      <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</p>
      <p className={`mt-1 truncate text-base font-semibold [overflow-wrap:anywhere] ${tone === 'warning' ? 'text-warning-fg' : tone === 'success' ? 'text-success-fg' : 'text-strong'}`} data-numeric>{value}</p>
    </Card>
  );
}
