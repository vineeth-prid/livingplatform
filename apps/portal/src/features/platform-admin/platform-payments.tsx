import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Lock, Receipt, ShieldCheck, Wallet, Wrench } from 'lucide-react';
import {
  Badge, Card, DataTable, EmptyState, LoadingState, PageContainer, PageHeader, SearchInput,
  StatCard, type Column,
} from '@living/ui';
import type { CommunityRevenueRow } from '@living/living-sdk';

import { living } from '../../lib/living';
import { inr } from '../billing/queries';
import { Tabs } from '../shared/tabs';

interface CommunityPaymentStatus {
  communityId: string;
  communityName: string;
  maintenanceReady: boolean;
  serviceReady: boolean;
}

/** A community's readiness and its collection totals, joined for one table. */
type Row = CommunityRevenueRow & { maintenanceReady: boolean; serviceReady: boolean };

const TABS = [
  { key: 'all', label: 'All communities' },
  { key: 'collecting', label: 'Collecting' },
  { key: 'maintenance', label: 'Maintenance rail' },
  { key: 'service', label: 'Service rail' },
  { key: 'unconfigured', label: 'Needs setup' },
];

/**
 * Platform Admin → Payments.
 *
 * Shows which community each rupee came from, split maintenance / service, so
 * the operator can reconcile against the gateway. That is a change of stance
 * from "status only": per-community revenue was previously withheld from the
 * operator on privacy grounds, and the operator — who runs the platform and
 * carries the gateway relationship — asked for it. What stays withheld is
 * everything below the total: no resident, unit, or invoice detail crosses the
 * tenant line, and gateway credentials remain unreadable to everyone.
 */
export function PlatformPaymentsPage() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const config = useQuery({
    queryKey: ['admin', 'payment-config'],
    queryFn: () => living.paymentConfig.platformOverview(),
  });
  const revenue = useQuery({
    queryKey: ['admin', 'revenue-by-community'],
    queryFn: () => living.platform.revenueByCommunity(),
  });

  if (config.isLoading || revenue.isLoading) {
    return <LoadingState label="Loading payment configuration…" />;
  }

  const readiness = new Map(
    (config.data ?? []).map((r: CommunityPaymentStatus) => [r.communityId, r]),
  );
  const all: Row[] = (revenue.data ?? []).map((r) => ({
    ...r,
    maintenanceReady: readiness.get(r.communityId)?.maintenanceReady ?? false,
    serviceReady: readiness.get(r.communityId)?.serviceReady ?? false,
  }));

  const q = search.trim().toLowerCase();
  const rows = all
    .filter((r) => {
      if (tab === 'collecting') return r.paymentCount > 0;
      if (tab === 'maintenance') return r.maintenanceCollected > 0;
      if (tab === 'service') return r.serviceCollected > 0;
      if (tab === 'unconfigured') return !r.maintenanceReady && !r.serviceReady;
      return true;
    })
    .filter((r) =>
      q === ''
        ? true
        : r.communityName.toLowerCase().includes(q) || r.communityCode.toLowerCase().includes(q));

  const sum = (pick: (r: Row) => number) => rows.reduce((total, r) => total + pick(r), 0);
  const collected = sum((r) => r.totalCollected);
  const maintenance = sum((r) => r.maintenanceCollected);
  const service = sum((r) => r.serviceCollected);
  const bothReady = rows.filter((r) => r.maintenanceReady && r.serviceReady).length;

  const columns: Column<Row>[] = [
    {
      key: 'community',
      header: 'Community',
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-medium text-strong">{r.communityName}</span>
          <span className="font-mono text-2xs text-subtle">{r.communityCode}</span>
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Collected',
      align: 'right',
      cell: (r) => (
        <span className={r.totalCollected > 0 ? 'font-medium text-strong' : 'text-subtle'} data-numeric>
          {inr(r.totalCollected)}
        </span>
      ),
    },
    {
      key: 'maintenance',
      header: 'Maintenance',
      align: 'right',
      cell: (r) => <RailCell amount={r.maintenanceCollected} ready={r.maintenanceReady} />,
    },
    {
      key: 'service',
      header: 'Service',
      align: 'right',
      cell: (r) => <RailCell amount={r.serviceCollected} ready={r.serviceReady} />,
    },
    {
      key: 'last30',
      header: 'Last 30 days',
      align: 'right',
      cell: (r) => (
        <span className={r.last30Days > 0 ? 'text-body' : 'text-subtle'} data-numeric>
          {inr(r.last30Days)}
        </span>
      ),
    },
    {
      key: 'activity',
      header: 'Payments',
      align: 'right',
      cell: (r) => (
        <span className="flex flex-col items-end">
          <span className="text-sm text-body" data-numeric>{r.paymentCount}</span>
          <span className="text-2xs text-subtle">
            {r.lastPaymentAt ? new Date(r.lastPaymentAt).toLocaleDateString() : 'never'}
          </span>
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform admin"
        title="Payments"
        description="Which community each payment came from, split by rail, and who is ready to collect."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected" value={inr(collected)} icon={Wallet} hint={`${rows.length} communities`} />
        <StatCard label="Maintenance rail" value={inr(maintenance)} icon={Receipt} />
        <StatCard label="Service rail" value={inr(service)} icon={Wrench} />
        <StatCard
          label="Fully onboarded"
          value={`${bothReady}/${rows.length}`}
          icon={ShieldCheck}
          tone={bothReady === rows.length ? 'success' : 'warning'}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Filter by community…"
          className="w-full sm:w-64"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={all.length === 0 ? 'No communities yet' : 'No communities match'}
          description={
            all.length === 0
              ? 'Provision a community to configure its collection rails.'
              : 'Try a different filter or clear the search.'
          }
        />
      ) : (
        <Card variant="elevated" className="mb-6 p-0">
          <DataTable rows={rows} columns={columns} rowKey={(r) => r.communityId} />
        </Card>
      )}

      <Card variant="elevated" className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-sm text-muted">
          Totals only. Resident, unit and invoice detail stay inside each community — an
          association reads its own books from its Collections dashboard. Key secrets and webhook
          secrets are encrypted at rest and are never returned by the API, to anyone. A rail reads{' '}
          <strong>ready</strong> when it is enabled and has both a key id and a stored secret.
        </p>
      </Card>
    </PageContainer>
  );
}

/** Money if collected; otherwise why not — unconfigured reads differently from ₹0. */
function RailCell({ amount, ready }: { amount: number; ready: boolean }) {
  if (amount > 0) return <span className="text-body" data-numeric>{inr(amount)}</span>;
  return ready ? (
    <Badge tone="neutral" size="sm">nothing yet</Badge>
  ) : (
    <Badge tone="warning" size="sm">not configured</Badge>
  );
}
