import { useMemo, useState } from 'react';
import { EmptyState, SearchInput, Skeleton } from '@living/ui';
import { cn } from '@living/utils';

import { JobCard, ProfileNotLinked } from '../components';
import type { JobKind } from '../execution';
import { useMyJobs } from '../jobs';
import { useWorker } from '../worker';
import { ScreenHeader } from '../shell';

type StatusFilter = 'active' | 'done' | 'all';
type KindFilter = 'all' | JobKind;

const KIND_CHIPS: [KindFilter, string][] = [
  ['all', 'All'], ['work-order', 'Work orders'], ['service-request', 'Services'], ['ticket', 'Tickets'],
];

/** The full queue — search + kind/status/priority filters over a responsive card
 *  grid (one column on a phone, two on a tablet). Job-first, minimal typing. */
export function JobsScreen() {
  const { isLinked, isLoading: workerLoading } = useWorker();
  const jobs = useMyJobs();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [kind, setKind] = useState<KindFilter>('all');
  const [highOnly, setHighOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.all.filter((j) =>
      (status === 'all' || (status === 'active' ? j.active : !j.active)) &&
      (kind === 'all' || j.kind === kind) &&
      (!highOnly || j.priority === 'HIGH' || j.priority === 'CRITICAL') &&
      (!needle || j.title.toLowerCase().includes(needle) || j.number.toLowerCase().includes(needle) ||
        (j.unitLabel?.toLowerCase().includes(needle) ?? false)),
    );
  }, [jobs.all, q, status, kind, highOnly]);

  return (
    <div>
      <ScreenHeader title="Jobs" subtitle="Living · Workforce" />

      <div className="flex flex-col gap-3 px-4">
        <SearchInput value={q} onValueChange={setQ} placeholder="Search jobs, numbers, units…" />

        <div role="tablist" aria-label="Status" className="flex gap-1.5">
          {(['active', 'done', 'all'] as const).map((s) => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
              className={cn('flex-1 rounded-pill px-3 py-2 text-sm font-medium capitalize transition-colors',
                status === s ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted')}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {KIND_CHIPS.map(([v, label]) => (
            <button key={v} onClick={() => setKind(v)}
              className={cn('rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
                kind === v ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted')}>
              {label}
            </button>
          ))}
          <button onClick={() => setHighOnly((v) => !v)} aria-pressed={highOnly}
            className={cn('rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
              highOnly ? 'bg-[var(--danger)] text-white' : 'bg-sunken text-muted')}>
            Priority
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 px-4 sm:grid-cols-2">
        {!isLinked && !workerLoading ? (
          <div className="sm:col-span-2"><ProfileNotLinked /></div>
        ) : workerLoading || jobs.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-card" />)
        ) : filtered.length === 0 ? (
          <div className="sm:col-span-2">
            <EmptyState title="No matching jobs" description="Try a different filter or search." />
          </div>
        ) : (
          filtered.map((j) => <JobCard key={j.id} job={j} />)
        )}
      </div>
    </div>
  );
}
