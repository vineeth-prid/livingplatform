import { CheckCircle2 } from 'lucide-react';
import { EmptyState, Skeleton } from '@living/ui';

import { JobCard, ProfileNotLinked, Section } from '../components';
import { useMyJobs } from '../jobs';
import { useWorker } from '../worker';
import { ScreenHeader } from '../shell';

/** A personal work log: what's in flight, and what you've recently finished —
 *  both drawn from the same assigned-jobs feed, newest activity first. */
export function ActivityScreen() {
  const { isLinked, isLoading: workerLoading } = useWorker();
  const jobs = useMyJobs();
  const loading = workerLoading || jobs.isLoading;

  return (
    <div>
      <ScreenHeader title="Activity" subtitle="Living · Workforce" />
      <div className="px-4">
        {!isLinked && !workerLoading ? (
          <ProfileNotLinked />
        ) : loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-card" />)}</div>
        ) : jobs.all.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No activity yet" description="Assigned jobs and your updates appear here." />
        ) : (
          <>
            {jobs.active.length > 0 && (
              <Section title="In flight" action={<span className="font-mono text-sm text-subtle" data-numeric>{jobs.active.length}</span>}>
                <div className="flex flex-col gap-2">{jobs.active.slice(0, 20).map((j) => <JobCard key={j.id} job={j} />)}</div>
              </Section>
            )}
            {jobs.done.length > 0 && (
              <Section title="Recently completed" action={<span className="font-mono text-sm text-subtle" data-numeric>{jobs.done.length}</span>}>
                <div className="flex flex-col gap-2">{jobs.done.slice(0, 20).map((j) => <JobCard key={j.id} job={j} />)}</div>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
