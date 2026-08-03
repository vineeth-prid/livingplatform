import { useQuery } from '@tanstack/react-query';
import {
  Building2, Lock, Package, Receipt, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import {
  Card, EmptyState, LoadingState, PageContainer, PageHeader, StatCard,
} from '@living/ui';

import { living } from '../../lib/living';
import { inr } from '../billing/queries';

/**
 * Platform Admin → Business.
 *
 * Aggregated intelligence only. There is deliberately no per-community revenue
 * anywhere on this page: the platform operator sees the size and shape of the
 * business, not any individual association's books. Module adoption is a count
 * of communities, and package popularity is merged by name.
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

        <Card variant="elevated" className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-sm text-muted">
            Every figure here is an aggregate across communities. Per-community revenue,
            outstanding balances and resident data are not exposed to the platform operator — an
            association reads its own numbers from its Community dashboard.
          </p>
        </Card>
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
