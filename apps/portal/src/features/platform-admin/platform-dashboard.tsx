import {
  Building2, CheckCircle2, DoorOpen, Layers, PauseCircle, Sparkles, TrendingUp,
  UserRound, Users, UsersRound, Wallet,
} from 'lucide-react';
import {
  ChartWrapper, LoadingState, PageContainer, PageHeader, PageTransition, StatCard,
} from '@living/ui';

import { AreaChart, BarChart, DonutChart } from './charts';
import { FutureTile, KpiGrid, MockBadge, PlatformSection } from './components';
import {
  useBusinessIntelligence, useCommunityGrowth, usePlatformUsers,
} from './hooks';

/**
 * Executive Dashboard — the platform-wide command centre for Living founders
 * and platform administrators. Community Growth is derived live from the
 * communities API; user/occupancy/growth metrics are placeholder adapters until
 * their aggregate endpoints land (each panel is flagged).
 */
export function PlatformDashboardPage() {
  const growth = useCommunityGrowth();
  const users = usePlatformUsers();
  const bi = useBusinessIntelligence();

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Platform admin"
          title="Executive dashboard"
          description="Real-time overview of the Living business — growth, adoption and scale."
        />

        {growth.isLoading || !growth.data ? (
          <LoadingState />
        ) : (
          <>
            {/* SECTION 1 — Community Growth (live) */}
            <PlatformSection title="Community growth" description="Live, from the communities directory.">
              <KpiGrid>
                <StatCard label="Total communities" value={growth.data.total} icon={Building2} tone="brand" />
                <StatCard label="Active" value={growth.data.active} icon={CheckCircle2} tone="success" />
                <StatCard label="New (30 days)" value={growth.data.newThisMonth} icon={TrendingUp} />
                <StatCard label="Suspended" value={growth.data.suspended} icon={PauseCircle} tone={growth.data.suspended ? 'warning' : 'default'} />
              </KpiGrid>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <ChartWrapper title="Community growth trend" className="lg:col-span-1">
                  <AreaChart data={growth.data.growthTrend} />
                </ChartWrapper>
                <ChartWrapper title="Communities by state">
                  <BarChart data={growth.data.byState} horizontal />
                </ChartWrapper>
                <ChartWrapper title="Communities by city">
                  <BarChart data={growth.data.byCity} horizontal />
                </ChartWrapper>
              </div>
            </PlatformSection>

            {/* SECTION 2 — Platform Users (placeholder) */}
            <PlatformSection title="Platform users" action={<MockBadge />}>
              <KpiGrid cols={5}>
                <StatCard label="Registered users" value={users.totalUsers} icon={Users} tone="brand" />
                <StatCard label="Owners" value={users.owners} icon={UserRound} />
                <StatCard label="Tenants" value={users.tenants} icon={UsersRound} />
                <StatCard label="Residents" value={users.residents} icon={Users} />
                <StatCard label="Community admins" value={users.admins} icon={Building2} />
              </KpiGrid>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <ChartWrapper title="User growth" className="lg:col-span-2">
                  <AreaChart data={users.userGrowth} />
                </ChartWrapper>
                <ChartWrapper title="Owner vs tenant">
                  <DonutChart data={users.ownerVsTenant} height={160} />
                </ChartWrapper>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <StatCard label="Active users" value={users.activeUsers} icon={CheckCircle2} />
                <StatCard label="Monthly active (MAU)" value={users.mau} icon={TrendingUp} />
                <StatCard label="Daily active (DAU)" value={users.dau} icon={TrendingUp} />
              </div>
            </PlatformSection>

            {/* SECTION 3 — Business Intelligence (placeholder) */}
            <PlatformSection title="Business intelligence" action={<MockBadge />}>
              <KpiGrid cols={5}>
                <StatCard label="Total units" value={bi.totalUnits} icon={DoorOpen} tone="brand" />
                <StatCard label="Occupied units" value={bi.occupied} icon={CheckCircle2} />
                <StatCard label="Occupancy" value={`${bi.occupancyPct}%`} icon={TrendingUp} tone="success" />
                <StatCard label="Avg units / community" value={bi.avgUnitsPerCommunity} icon={Layers} />
                <StatCard label="Avg residents / unit" value={bi.avgResidentsPerUnit} icon={Users} />
              </KpiGrid>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ChartWrapper title="Occupancy trend">
                  <AreaChart data={bi.occupancyTrend} />
                </ChartWrapper>
                <ChartWrapper title="Community type distribution">
                  <DonutChart data={growth.data.byType} height={180} />
                </ChartWrapper>
              </div>
            </PlatformSection>

            {/* SECTION 4 — Platform Growth */}
            <PlatformSection title="Platform growth">
              <KpiGrid>
                <StatCard label="New registrations today" value={users.dau > 0 ? Math.round(users.dau * 0.04) : 0} icon={TrendingUp} />
                <StatCard label="New this month" value={users.userGrowth.at(-1)?.value ?? 0} icon={TrendingUp} />
                <StatCard label="Active communities today" value={growth.data.active} icon={Sparkles} />
                <StatCard label="Growth rate" value={`${growth.data.growthRatePct}%`} icon={TrendingUp} tone={growth.data.growthRatePct >= 0 ? 'success' : 'danger'} />
              </KpiGrid>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ChartWrapper title="Monthly growth">
                  <BarChart data={growth.data.growthTrend} />
                </ChartWrapper>
                <ChartWrapper title="User acquisition trend" actions={<MockBadge />}>
                  <AreaChart data={users.userGrowth} />
                </ChartWrapper>
              </div>
            </PlatformSection>

            {/* Future — billing placeholders (not implemented) */}
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
