import {
  Building2, CheckCircle2, DoorOpen, Layers, PauseCircle, Sparkles, TrendingUp,
  UserRound, Users, UsersRound, Wallet,
} from 'lucide-react';
import {
  ChartWrapper, ErrorState, LoadingState, PageContainer, PageHeader, PageTransition, StatCard,
} from '@living/ui';

import { AreaChart, BarChart, DonutChart } from './charts';
import { FutureTile, KpiGrid, PlatformSection } from './components';
import { useOverview } from './hooks';

/**
 * Executive Dashboard — the platform-wide command centre for Living founders and
 * platform administrators. Every figure is a live aggregate from
 * /admin/stats/overview; it polls and reflects real data as it is populated.
 */
export function PlatformDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useOverview();

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Platform admin"
          title="Executive dashboard"
          description="Real-time overview of the Living business — growth, adoption and scale."
        />

        {isLoading ? (
          <LoadingState />
        ) : isError || !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : (
          <>
            {/* SECTION 1 — Community Growth */}
            <PlatformSection title="Community growth">
              <KpiGrid>
                <StatCard label="Total communities" value={data.communities.total} icon={Building2} tone="brand" />
                <StatCard label="Active" value={data.communities.active} icon={CheckCircle2} tone="success" />
                <StatCard label="New (30 days)" value={data.communities.newThisMonth} icon={TrendingUp} />
                <StatCard label="Suspended" value={data.communities.suspended} icon={PauseCircle} tone={data.communities.suspended ? 'warning' : 'default'} />
              </KpiGrid>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <ChartWrapper title="Community growth trend">
                  <AreaChart data={data.communities.growthTrend} />
                </ChartWrapper>
                <ChartWrapper title="Communities by state">
                  <BarChart data={data.communities.byState} horizontal />
                </ChartWrapper>
                <ChartWrapper title="Communities by city">
                  <BarChart data={data.communities.byCity} horizontal />
                </ChartWrapper>
              </div>
            </PlatformSection>

            {/* SECTION 2 — Platform Users */}
            <PlatformSection title="Platform users">
              <KpiGrid cols={5}>
                <StatCard label="Registered users" value={data.users.total} icon={Users} tone="brand" />
                <StatCard label="Owners" value={data.users.owners} icon={UserRound} />
                <StatCard label="Tenants" value={data.users.tenants} icon={UsersRound} />
                <StatCard label="Residents" value={data.users.residents} icon={Users} />
                <StatCard label="Community admins" value={data.users.admins} icon={Building2} />
              </KpiGrid>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <ChartWrapper title="User growth" className="lg:col-span-2">
                  <AreaChart data={data.users.growth} />
                </ChartWrapper>
                <ChartWrapper title="Owner vs tenant">
                  <DonutChart data={data.users.ownerVsTenant} height={160} />
                </ChartWrapper>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <StatCard label="Active users (30d)" value={data.users.active} icon={CheckCircle2} />
                <StatCard label="Monthly active (MAU)" value={data.users.mau} icon={TrendingUp} />
                <StatCard label="Daily active (DAU)" value={data.users.dau} icon={TrendingUp} />
              </div>
            </PlatformSection>

            {/* SECTION 3 — Business Intelligence */}
            <PlatformSection title="Business intelligence">
              <KpiGrid cols={5}>
                <StatCard label="Total units" value={data.units.total} icon={DoorOpen} tone="brand" />
                <StatCard label="Occupied units" value={data.units.occupied} icon={CheckCircle2} />
                <StatCard label="Occupancy" value={`${data.units.occupancyPct}%`} icon={TrendingUp} tone="success" />
                <StatCard label="Avg units / community" value={data.units.avgPerCommunity} icon={Layers} />
                <StatCard label="Avg residents / unit" value={data.units.avgResidentsPerUnit} icon={Users} />
              </KpiGrid>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ChartWrapper title="Community type distribution">
                  <DonutChart data={data.communities.byType} height={180} />
                </ChartWrapper>
                <ChartWrapper title="Community size by type">
                  <BarChart data={data.communities.byType} horizontal />
                </ChartWrapper>
              </div>
            </PlatformSection>

            {/* SECTION 4 — Platform Growth */}
            <PlatformSection title="Platform growth">
              <KpiGrid>
                <StatCard label="New registrations today" value={data.users.newToday} icon={TrendingUp} />
                <StatCard label="New this month" value={data.users.newThisMonth} icon={TrendingUp} />
                <StatCard label="Active communities" value={data.communities.active} icon={Sparkles} />
                <StatCard label="New communities today" value={data.communities.newToday} icon={TrendingUp} />
              </KpiGrid>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ChartWrapper title="Monthly community growth">
                  <BarChart data={data.communities.growthTrend} />
                </ChartWrapper>
                <ChartWrapper title="User acquisition trend">
                  <AreaChart data={data.users.growth} />
                </ChartWrapper>
              </div>
            </PlatformSection>

            {/* Future — billing placeholders (out of scope) */}
            <PlatformSection title="Revenue" description="Reserved — billing arrives in a later sprint.">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                {['Revenue', 'MRR', 'ARR', 'Churn', 'Trials', 'Subscriptions'].map((l) => (
                  <FutureTile key={l} label={l} />
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle">
                <Wallet className="h-3.5 w-3.5" /> Billing, subscriptions and payments are out of scope for this release.
              </p>
            </PlatformSection>
          </>
        )}
      </PageContainer>
    </PageTransition>
  );
}
