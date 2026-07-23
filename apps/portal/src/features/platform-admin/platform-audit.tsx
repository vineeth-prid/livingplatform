import { useMemo, useState } from 'react';
import {
  Activity, KeyRound, LogIn, ShieldAlert, ShieldCheck, UserCog,
} from 'lucide-react';
import {
  Badge, Card, ChartWrapper, Input, PageContainer, PageHeader, PageTransition, StatCard,
} from '@living/ui';

import { AreaChart } from './charts';
import { KpiGrid, MockBadge, PlatformSection, StatusCard } from './components';
import { useAuditLog, useJobs, usePerformanceMetrics, usePlatformHealth } from './hooks';

/**
 * Audit & Monitoring — platform health, security events, performance, jobs and
 * the audit log. Platform Health is live from /health/ready; the rest are
 * placeholder adapters until their endpoints ship (each panel is flagged).
 */
export function PlatformAuditPage() {
  const health = usePlatformHealth();
  const perf = usePerformanceMetrics();
  const jobs = useJobs();

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Platform admin"
          title="Audit & monitoring"
          description="Health, security and usage of the Living platform."
        />

        {/* Platform Health (live) */}
        <PlatformSection title="Platform health" description="Live readiness probe.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {(health.data?.deps ?? [
              { name: 'PostgreSQL', ok: false }, { name: 'Redis', ok: false },
              { name: 'MinIO', ok: false }, { name: 'Memory', ok: false },
            ]).map((d) => <StatusCard key={d.name} name={d.name} ok={d.ok} />)}
            <StatusCard name="API" ok={!!health.data?.overall || !health.isError} />
            <StatusCard name="Scheduler" ok />
          </div>
        </PlatformSection>

        {/* Authentication + Security (placeholder counters) */}
        <PlatformSection title="Authentication" action={<MockBadge />}>
          <KpiGrid>
            <StatCard label="Logins (24h)" value={128} icon={LogIn} tone="brand" />
            <StatCard label="Failed logins" value={6} icon={ShieldAlert} tone="warning" />
            <StatCard label="Password resets" value={3} icon={KeyRound} />
            <StatCard label="MFA events" value={0} icon={ShieldCheck} />
          </KpiGrid>
        </PlatformSection>

        <PlatformSection title="Security" action={<MockBadge />}>
          <KpiGrid>
            <StatCard label="Permission changes" value={2} icon={UserCog} />
            <StatCard label="Role changes" value={1} icon={UserCog} />
            <StatCard label="Communities created" value={4} icon={ShieldCheck} />
            <StatCard label="Login-as events" value={5} icon={LogIn} tone="warning" />
          </KpiGrid>
        </PlatformSection>

        {/* Performance (placeholder) */}
        <PlatformSection title="Performance" action={<MockBadge />}>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartWrapper title="API requests (24h)"><AreaChart data={perf.apiRequests} /></ChartWrapper>
            <ChartWrapper title="Average response time (ms)"><AreaChart data={perf.responseTimeMs} /></ChartWrapper>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Error rate" value={`${perf.errorRatePct}%`} icon={ShieldAlert} tone={perf.errorRatePct > 1 ? 'danger' : 'success'} />
            <StatCard label="Storage used" value={`${perf.storageUsedGb} GB`} icon={Activity} />
            <StatCard label="Upload volume (7d)" value={perf.uploadVolume.reduce((s, d) => s + d.value, 0)} icon={Activity} />
          </div>
        </PlatformSection>

        {/* Jobs (placeholder) */}
        <PlatformSection title="Jobs" action={<MockBadge />}>
          <div className="grid gap-4 lg:grid-cols-2">
            <JobTable title="Running" rows={jobs.running.map((j) => [j.name, j.startedAt, j.status])} head={['Job', 'Started', 'Status']} />
            <JobTable title="Failed" rows={jobs.failed.map((j) => [j.name, j.startedAt, j.error ?? '—'])} head={['Job', 'When', 'Error']} tone="danger" />
            <JobTable title="Scheduled" rows={jobs.scheduled.map((j) => [j.name, j.schedule, j.next])} head={['Job', 'Cron', 'Next run']} />
            <JobTable title="Retry queue" rows={jobs.retryQueue.map((j) => [j.name, String(j.attempts)])} head={['Job', 'Attempts']} />
          </div>
        </PlatformSection>

        {/* Audit log (placeholder) */}
        <PlatformSection title="Audit log" action={<MockBadge />} description="Search and filter platform activity.">
          <AuditLogTable />
        </PlatformSection>
      </PageContainer>
    </PageTransition>
  );
}

function JobTable({ title, head, rows, tone }: { title: string; head: string[]; rows: string[][]; tone?: 'danger' }) {
  return (
    <Card variant="elevated" padded={false} className="overflow-hidden">
      <div className="border-b border-border-subtle px-4 py-2.5 text-sm font-semibold text-strong">{title}</div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-subtle">Nothing here.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-2xs uppercase tracking-wider text-subtle">
            {head.map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border-subtle">
                {r.map((cell, j) => (
                  <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-strong' : tone === 'danger' && j === r.length - 1 ? 'text-danger-fg' : 'text-muted'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function AuditLogTable() {
  const rows = useAuditLog();
  const [q, setQ] = useState('');
  const [module, setModule] = useState('');
  const modules = useMemo(() => [...new Set(rows.map((r) => r.module))], [rows]);
  const filtered = rows.filter((r) =>
    (!q || `${r.user} ${r.action} ${r.ip}`.toLowerCase().includes(q.toLowerCase())) &&
    (!module || r.module === module));

  return (
    <Card variant="elevated" padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, action, IP…" className="max-w-xs" />
        <select value={module} onChange={(e) => setModule(e.target.value)}
          className="h-10 rounded-control border border-border bg-raised px-3 text-sm text-strong outline-none">
          <option value="">All modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-2xs uppercase tracking-wider text-subtle">
            {['Time', 'User', 'Action', 'Module', 'IP address', 'Status'].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border-subtle">
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.at}</td>
                <td className="px-4 py-2.5 text-strong">{r.user}</td>
                <td className="px-4 py-2.5 text-muted">{r.action}</td>
                <td className="px-4 py-2.5"><Badge tone="neutral" size="sm">{r.module}</Badge></td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.ip}</td>
                <td className="px-4 py-2.5"><Badge tone={r.status === 'ok' ? 'success' : 'danger'} size="sm">{r.status === 'ok' ? 'OK' : 'Failed'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
