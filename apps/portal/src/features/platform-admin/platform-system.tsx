import { Boxes, Database, HardDrive, Server } from 'lucide-react';
import {
  Card, ChartWrapper, LoadingState, PageContainer, PageHeader, PageTransition, StatCard,
} from '@living/ui';

import { BarChart } from './charts';
import { InfoRow, KpiGrid, PlatformSection, StatusCard } from './components';
import { usePlatformHealth, useSystemInfo } from './hooks';

/**
 * System — live infrastructure visibility for the Living platform: application
 * info, dependency health, storage (summed from stored file metadata), queues
 * and environment. All read from the backend; no secrets are exposed.
 */
export function PlatformSystemPage() {
  const health = usePlatformHealth();
  const system = useSystemInfo();
  const info = system.data;

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

        {system.isLoading || !info ? (
          <LoadingState />
        ) : (
          <>
            {/* Application */}
            <PlatformSection title="Application">
              <Card variant="elevated">
                <InfoRow label="Current version" value={info.app.version} />
                <InfoRow label="Release version" value={info.app.releaseVersion} />
                <InfoRow label="Build date" value={info.app.buildDate ?? '—'} />
                <InfoRow label="Environment" value={<span className="font-mono">{info.app.environment}</span>} />
                <InfoRow label="Uptime" value={info.app.uptime} />
                <InfoRow label="Storage driver" value={<span className="font-mono">{info.app.storageDriver}</span>} />
              </Card>
            </PlatformSection>

            {/* Infrastructure (health live) */}
            <PlatformSection title="Infrastructure" description="Live readiness probe for core dependencies.">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <StatusCard name="PostgreSQL" ok={depOk('PostgreSQL')} />
                <StatusCard name="Redis" ok={depOk('Redis')} />
                <StatusCard name="MinIO" ok={depOk('MinIO')} />
                <StatusCard name="API" ok={!health.isError} />
                <StatusCard name="Memory" ok={depOk('Memory')} />
                <StatusCard name="Scheduler" ok={info.jobs.scheduled.length > 0} detail={`${info.jobs.scheduled.length} jobs`} />
              </div>
            </PlatformSection>

            {/* Storage (summed from stored file metadata) */}
            <PlatformSection title="Storage" description="From stored document & attachment metadata.">
              <KpiGrid cols={3}>
                <StatCard label="Used storage" value={fmtMb(info.storage.usedMb)} icon={HardDrive} tone="brand" />
                <StatCard label="Community documents" value={fmtMb(info.storage.communityStorageMb)} icon={Boxes} />
                <StatCard label="Communities with files" value={info.storage.byCommunity.length} icon={Server} />
              </KpiGrid>
              {info.storage.byCommunity.length > 0 && (
                <div className="mt-4">
                  <ChartWrapper title="Storage by community (MB)">
                    <BarChart data={info.storage.byCommunity} horizontal />
                  </ChartWrapper>
                </div>
              )}
            </PlatformSection>

            {/* Queues (real scheduled crons; run history not persisted) */}
            <PlatformSection title="Queues">
              <KpiGrid cols={3}>
                <StatCard label="Scheduled jobs" value={info.jobs.scheduled.length} icon={Server} />
                <StatCard label="Running jobs" value={info.jobs.running.length} icon={Server} />
                <StatCard label="Failed jobs" value={info.jobs.failed.length} icon={Server} tone={info.jobs.failed.length ? 'danger' : 'default'} />
              </KpiGrid>
            </PlatformSection>

            {/* Environment (no secrets) */}
            <PlatformSection title="Environment" description="No secrets are exposed.">
              <Card variant="elevated">
                <InfoRow label="Environment" value={<span className="font-mono">{info.app.environment}</span>} />
                <InfoRow label="Node version" value={info.app.nodeVersion} />
                <InfoRow label="Database" value={<span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> {info.versions.database ?? 'Unknown'}</span>} />
                <InfoRow label="Redis" value={info.versions.redis ? `Redis ${info.versions.redis}` : 'Unknown'} />
              </Card>
            </PlatformSection>
          </>
        )}
      </PageContainer>
    </PageTransition>
  );
}

const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);
