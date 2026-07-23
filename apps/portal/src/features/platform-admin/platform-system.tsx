import { Boxes, Database, HardDrive, Server } from 'lucide-react';
import {
  Card, ChartWrapper, PageContainer, PageHeader, PageTransition, StatCard,
} from '@living/ui';

import { AreaChart, BarChart } from './charts';
import { InfoRow, KpiGrid, MockBadge, PlatformSection, StatusCard } from './components';
import { useJobs, usePlatformHealth, useStorageStats, useSystemInfo } from './hooks';

/**
 * System — infrastructure visibility for the Living platform: application info,
 * dependency health (live), storage, queues and environment. Non-health panels
 * are placeholder adapters until their endpoints ship (flagged). No secrets.
 */
export function PlatformSystemPage() {
  const info = useSystemInfo();
  const health = usePlatformHealth();
  const storage = useStorageStats();
  const jobs = useJobs();

  const deps = health.data?.deps ?? [];
  const depOk = (name: string) => deps.find((d) => d.name === name)?.ok ?? false;

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Platform admin"
          title="System"
          description="Infrastructure, storage and environment for the Living platform."
        />

        {/* Application (placeholder) */}
        <PlatformSection title="Application" action={<MockBadge />}>
          <Card variant="elevated">
            <InfoRow label="Current version" value={info.version} />
            <InfoRow label="Release version" value={info.releaseVersion} />
            <InfoRow label="Build date" value={info.buildDate} />
            <InfoRow label="Environment" value={<span className="font-mono">{info.environment}</span>} />
            <InfoRow label="Uptime" value={info.uptime} />
          </Card>
        </PlatformSection>

        {/* Infrastructure (health live) */}
        <PlatformSection title="Infrastructure" description="Live readiness probe for core dependencies.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatusCard name="PostgreSQL" ok={depOk('PostgreSQL')} />
            <StatusCard name="Redis" ok={depOk('Redis')} />
            <StatusCard name="MinIO" ok={depOk('MinIO')} />
            <StatusCard name="API" ok={!health.isError} />
            <StatusCard name="Workers" ok />
            <StatusCard name="Scheduler" ok />
          </div>
        </PlatformSection>

        {/* Storage (placeholder) */}
        <PlatformSection title="Storage" action={<MockBadge />}>
          <KpiGrid>
            <StatCard label="Total storage" value={`${storage.totalGb} GB`} icon={HardDrive} tone="brand" />
            <StatCard label="Used storage" value={`${storage.usedGb} GB`} icon={HardDrive} />
            <StatCard label="Community storage" value={`${storage.communityStorageGb} GB`} icon={Boxes} />
            <StatCard label="Upload growth (mo)" value={`+${storage.growth.at(-1)?.value ?? 0} GB`} icon={Server} />
          </KpiGrid>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartWrapper title="Storage growth"><AreaChart data={storage.growth} /></ChartWrapper>
            <ChartWrapper title="Storage by community"><BarChart data={storage.byCommunity} horizontal /></ChartWrapper>
          </div>
        </PlatformSection>

        {/* Queues (placeholder) */}
        <PlatformSection title="Queues" action={<MockBadge />}>
          <KpiGrid cols={3}>
            <StatCard label="Running jobs" value={jobs.running.length} icon={Server} />
            <StatCard label="Pending jobs" value={jobs.scheduled.length} icon={Server} />
            <StatCard label="Failed jobs" value={jobs.failed.length} icon={Server} tone={jobs.failed.length ? 'danger' : 'default'} />
          </KpiGrid>
        </PlatformSection>

        {/* Environment (placeholder, no secrets) */}
        <PlatformSection title="Environment" action={<MockBadge />} description="No secrets are exposed.">
          <Card variant="elevated">
            <InfoRow label="Environment" value={<span className="font-mono">{info.environment}</span>} />
            <InfoRow label="Docker version" value={info.dockerVersion} />
            <InfoRow label="Node version" value={info.nodeVersion} />
            <InfoRow label="Database version" value={<span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> {info.databaseVersion}</span>} />
            <InfoRow label="Redis version" value={info.redisVersion} />
          </Card>
        </PlatformSection>
      </PageContainer>
    </PageTransition>
  );
}
