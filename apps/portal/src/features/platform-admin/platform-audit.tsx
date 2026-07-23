import { useMemo, useState } from 'react';
import {
  KeyRound, LogIn, ShieldAlert, ShieldCheck, UserCog,
} from 'lucide-react';
import { debounce } from '@living/utils';
import {
  Badge, Card, Input, LoadingState, PageContainer, PageHeader, PageTransition, Pagination, StatCard,
} from '@living/ui';

import { KpiGrid, PlatformSection, StatusCard } from './components';
import {
  useAuditLog, useAuditModules, useAuditSummary, usePlatformHealth, useSystemInfo,
} from './hooks';

/**
 * Audit & Monitoring — live platform health, security/activity counters and the
 * audit log, all read from the database. Nothing is mocked; empty tables mean
 * no events have been recorded yet and fill in as activity happens.
 */
export function PlatformAuditPage() {
  const health = usePlatformHealth();
  const summary = useAuditSummary();
  const system = useSystemInfo();
  const jobs = system.data?.jobs;

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
            <StatusCard name="API" ok={!health.isError} />
            <StatusCard name="Scheduler" ok={(jobs?.scheduled.length ?? 0) > 0} detail={jobs ? `${jobs.scheduled.length} jobs` : undefined} />
          </div>
        </PlatformSection>

        {/* Activity (last 24h, from the audit log) */}
        <PlatformSection title="Activity — last 24 hours" description="Derived from the audit log.">
          <KpiGrid>
            <StatCard label="Logins" value={summary.data?.logins ?? 0} icon={LogIn} tone="brand" />
            <StatCard label="Failed logins" value={summary.data?.failedLogins ?? 0} icon={ShieldAlert} tone={(summary.data?.failedLogins ?? 0) > 0 ? 'warning' : 'default'} />
            <StatCard label="Password resets" value={summary.data?.passwordResets ?? 0} icon={KeyRound} />
            <StatCard label="Error rate" value={`${summary.data?.errorRatePct ?? 0}%`} icon={ShieldAlert} tone={(summary.data?.errorRatePct ?? 0) > 1 ? 'danger' : 'success'} />
          </KpiGrid>
          <div className="mt-3">
            <KpiGrid>
              <StatCard label="Permission changes" value={summary.data?.permissionChanges ?? 0} icon={UserCog} />
              <StatCard label="Role changes" value={summary.data?.roleChanges ?? 0} icon={UserCog} />
              <StatCard label="Communities created" value={summary.data?.communitiesCreated ?? 0} icon={ShieldCheck} />
              <StatCard label="Login-as events" value={summary.data?.loginAs ?? 0} icon={LogIn} tone={(summary.data?.loginAs ?? 0) > 0 ? 'warning' : 'default'} />
            </KpiGrid>
          </div>
        </PlatformSection>

        {/* Jobs (real scheduled crons; run history not persisted yet) */}
        <PlatformSection title="Scheduled jobs" description="Registered background jobs.">
          <JobTable
            head={['Job', 'Next run']}
            rows={(jobs?.scheduled ?? []).map((j) => [j.name, j.next ? new Date(j.next).toLocaleString() : '—'])}
          />
        </PlatformSection>

        {/* Audit log (real) */}
        <PlatformSection title="Audit log" description="Search and filter platform activity.">
          <AuditLogTable />
        </PlatformSection>
      </PageContainer>
    </PageTransition>
  );
}

function JobTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <Card variant="elevated" padded={false} className="overflow-hidden">
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-subtle">No scheduled jobs.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-2xs uppercase tracking-wider text-subtle">
            {head.map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border-subtle">
                {r.map((cell, j) => (
                  <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-strong' : 'text-muted'}`}>{cell}</td>
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
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const [resource, setResource] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useMemo(() => debounce((v: string) => { setSearch(v); setPage(1); }, 300), []);
  const modules = useAuditModules();
  const q = useAuditLog({ search: search || undefined, resource: resource || undefined, page });

  return (
    <Card variant="elevated" padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle p-3">
        <Input value={rawSearch} onChange={(e) => { setRawSearch(e.target.value); debouncedSearch(e.target.value); }} placeholder="Search user, action, IP…" className="max-w-xs" />
        <select value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }}
          className="h-10 rounded-control border border-border bg-raised px-3 text-sm text-strong outline-none">
          <option value="">All modules</option>
          {(modules.data ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {q.isLoading ? (
        <LoadingState className="py-10" />
      ) : (q.data?.items.length ?? 0) === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-subtle">No audit events recorded yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-2xs uppercase tracking-wider text-subtle">
                {['Time', 'User', 'Action', 'Module', 'IP address', 'Status'].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {q.data!.items.map((r) => {
                  const ok = (r.statusCode ?? 200) < 400;
                  return (
                    <tr key={r.id} className="border-t border-border-subtle">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-strong">{r.actorEmail ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted">{r.action}</td>
                      <td className="px-4 py-2.5"><Badge tone="neutral" size="sm">{r.resource}</Badge></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.ipAddress ?? '—'}</td>
                      <td className="px-4 py-2.5"><Badge tone={ok ? 'success' : 'danger'} size="sm">{r.statusCode ?? '—'}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {q.data!.meta.total > q.data!.meta.limit && (
            <Pagination meta={q.data!.meta} onPageChange={setPage} />
          )}
        </>
      )}
    </Card>
  );
}
