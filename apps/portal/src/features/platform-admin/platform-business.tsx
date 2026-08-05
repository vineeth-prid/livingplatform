import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Package, Receipt, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import {
  Badge, Card, EmptyState, LoadingState, PageContainer, PageHeader, SearchInput, StatCard,
} from '@living/ui';

import { living } from '../../lib/living';
import { inr } from '../billing/queries';

/**
 * Platform Admin → Business.
 *
 * Aggregates, plus one per-community breakdown: what each community has
 * collected on the maintenance rail, which the operator asked for to see where
 * the money comes from. Everything else stays aggregate — package popularity is
 * merged by name, and no resident, unit or invoice detail appears here. Per-rail
 * totals across both rails live on the Payments page.
 */
export function PlatformBusinessPage() {
  const business = useQuery({
    queryKey: ['admin', 'business'],
    queryFn: () => living.insights.platform(),
  });

  if (business.isLoading || !business.data) {
    return <LoadingState label="Loading business intelligence…" />;
  }
  const b = business.data;
  const growth = b.revenue.growthPercent;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform admin"
        title="Business"
        description="Module adoption, service and package popularity, and aggregate revenue across every community."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Communities"
          value={b.communities.total}
          icon={Building2}
          hint={`${b.communities.active} active`}
        />
        <StatCard
          label="Maintenance billing"
          value={`${b.communities.maintenanceEnabled} on`}
          icon={Receipt}
          hint={`${b.communities.maintenanceDisabled} collect outside Living`}
        />
        <StatCard
          label="Total collected"
          value={inr(b.revenue.totalCollected)}
          icon={Wallet}
          hint={`${inr(b.revenue.averagePerCommunity)} average per community`}
        />
        <StatCard
          label="Last 30 days"
          value={inr(b.revenue.last30Days)}
          icon={growth !== null && growth < 0 ? TrendingDown : TrendingUp}
          tone={growth !== null && growth < 0 ? 'warning' : 'success'}
          hint={
            growth === null
              ? 'No prior period to compare'
              : `${growth >= 0 ? '+' : ''}${growth}% vs the previous 30 days`
          }
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card variant="elevated">
          <h2 className="mb-4 font-display text-h4 tracking-tight text-strong">Adoption</h2>
          <AdoptionBar
            label="Collecting payments"
            value={b.adoption.communitiesCollecting}
            total={b.communities.total}
            percent={b.adoption.paymentAdoptionPercent}
          />
          <AdoptionBar
            label="Selling packages"
            value={b.adoption.communitiesSellingPackages}
            total={b.communities.total}
            percent={b.adoption.packageAdoptionPercent}
          />
          <AdoptionBar
            label="Packages published"
            value={b.adoption.communitiesWithPackages}
            total={b.communities.total}
            percent={Math.round(
              (b.adoption.communitiesWithPackages / Math.max(1, b.communities.total)) * 100,
            )}
          />
          <AdoptionBar
            label="Service packages enabled"
            value={b.communities.packagesEnabled}
            total={b.communities.total}
            percent={Math.round(
              (b.communities.packagesEnabled / Math.max(1, b.communities.total)) * 100,
            )}
          />
        </Card>

        <MaintenanceByCommunity />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Leaderboard
          title="Most popular services"
          icon={Wallet}
          rows={b.popularServices.map((s) => ({ name: s.name, value: s.bookings, unit: 'bookings' }))}
        />
        <Leaderboard
          title="Most popular packages"
          icon={Package}
          rows={b.popularPackages.map((p) => ({ name: p.name, value: p.purchases, unit: 'purchases' }))}
        />
      </div>
    </PageContainer>
  );
}

/**
 * Which communities run maintenance billing through Living, and what each has
 * collected on that rail. Shares the Payments page's query, so switching pages
 * costs no extra fetch.
 */
function MaintenanceByCommunity() {
  const [search, setSearch] = useState('');
  const [onlyEnabled, setOnlyEnabled] = useState(false);

  const revenue = useQuery({
    queryKey: ['admin', 'revenue-by-community'],
    queryFn: () => living.platform.revenueByCommunity(),
  });

  const q = search.trim().toLowerCase();
  const rows = (revenue.data ?? [])
    .filter((r) => (onlyEnabled ? r.maintenanceEnabled : true))
    .filter((r) =>
      q === ''
        ? true
        : r.communityName.toLowerCase().includes(q) || r.communityCode.toLowerCase().includes(q))
    .sort((a, b) => b.maintenanceCollected - a.maintenanceCollected);

  return (
    <Card variant="elevated">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-h4 tracking-tight text-strong">
          <Receipt className="h-4 w-4 text-muted" /> Maintenance by community
        </h2>
        <button
          type="button"
          onClick={() => setOnlyEnabled((v) => !v)}
          className="text-xs text-brand transition-colors hover:text-brand-strong"
        >
          {onlyEnabled ? 'Show all' : 'Only billing through Living'}
        </button>
      </div>

      <SearchInput
        value={search}
        onValueChange={setSearch}
        placeholder="Filter by community…"
        className="mb-3"
      />

      {revenue.isLoading ? (
        <LoadingState label="Loading communities…" />
      ) : rows.length === 0 ? (
        <EmptyState title="No communities match" description="Try a different filter." />
      ) : (
        <ul className="flex max-h-80 flex-col divide-y divide-border-subtle overflow-y-auto">
          {rows.map((r) => (
            <li key={r.communityId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-body">{r.communityName}</span>
              {r.maintenanceEnabled ? (
                <span className="text-sm text-strong" data-numeric>{inr(r.maintenanceCollected)}</span>
              ) : (
                <Badge tone="neutral" size="sm">collects outside Living</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AdoptionBar({
  label,
  value,
  total,
  percent,
}: {
  label: string;
  value: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-body">{label}</span>
        <span className="text-sm text-muted">
          <span className="font-medium text-strong" data-numeric>
            {value}
          </span>
          /{total} · {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${Math.min(100, percent)}%` }}
          role="img"
          aria-label={`${label}: ${percent}%`}
        />
      </div>
    </div>
  );
}

function Leaderboard({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Package;
  rows: Array<{ name: string; value: number; unit: string }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card variant="elevated">
      <h2 className="mb-4 flex items-center gap-2 font-display text-h4 tracking-tight text-strong">
        <Icon className="h-4 w-4 text-muted" /> {title}
      </h2>
      {rows.length === 0 ? (
        <EmptyState title="Nothing booked yet" description="Popularity appears as usage grows." />
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-body">
                  <span className="mr-2 text-subtle">{index + 1}</span>
                  {row.name}
                </span>
                <span className="shrink-0 text-sm text-muted">
                  <span className="font-medium text-strong" data-numeric>
                    {row.value}
                  </span>{' '}
                  {row.unit}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
