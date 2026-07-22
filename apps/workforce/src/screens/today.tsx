import { AlertTriangle, CalendarClock, CheckCircle2, Flame, PlayCircle } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { EmptyState, Skeleton } from '@living/ui';

import { JobCard, ProfileNotLinked, Section } from '../components';
import { useMyJobs } from '../jobs';
import { useWorker } from '../worker';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** The day at a glance: resume in-progress work, then priority / overdue / today
 *  / upcoming — ordered so the next tap is always the most urgent job. */
export function TodayScreen() {
  const { session } = useAuth();
  const { community, isLinked, isLoading: workerLoading } = useWorker();
  const jobs = useMyJobs();
  const loading = workerLoading || jobs.isLoading;

  const resume = jobs.inProgress[0];
  const nothingToday =
    !loading && jobs.priority.length === 0 && jobs.overdue.length === 0 &&
    jobs.today.length === 0 && jobs.upcoming.length === 0 && !resume;

  return (
    <div className="px-4">
      <div className="pb-4 pt-8">
        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">{community?.name ?? 'Living · Workforce'}</p>
        <h1 className="mt-1 font-display text-h1 leading-tight tracking-tight text-strong">
          {greeting()}{session?.user.firstName ? `, ${session.user.firstName}` : ''}.
        </h1>
      </div>

      {!isLinked && !workerLoading ? (
        <ProfileNotLinked />
      ) : loading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-card" />)}</div>
      ) : nothingToday ? (
        <EmptyState icon={CheckCircle2} title="You’re all clear" description="No open jobs assigned to you right now." />
      ) : (
        <>
          {resume && (
            <Section title="Resume work" action={<PlayCircle className="h-5 w-5 text-brand" />}>
              <JobCard job={resume} emphasis />
            </Section>
          )}

          {jobs.priority.length > 0 && (
            <Section title="Priority" action={<Flame className="h-4 w-4 text-[var(--danger)]" />}>
              <div className="flex flex-col gap-2">
                {jobs.priority.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            </Section>
          )}

          {jobs.overdue.length > 0 && (
            <Section title="Overdue" action={<AlertTriangle className="h-4 w-4 text-[var(--warning)]" />}>
              <div className="flex flex-col gap-2">
                {jobs.overdue.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            </Section>
          )}

          <Section title="Today" action={<span className="font-mono text-sm text-subtle" data-numeric>{jobs.today.length}</span>}>
            {jobs.today.length === 0 ? (
              <EmptyState title="Nothing scheduled today" description="Check your full queue in Jobs." />
            ) : (
              <div className="flex flex-col gap-2">{jobs.today.map((j) => <JobCard key={j.id} job={j} />)}</div>
            )}
          </Section>

          {jobs.upcoming.length > 0 && (
            <Section title="Upcoming" action={<CalendarClock className="h-4 w-4 text-subtle" />}>
              <div className="flex flex-col gap-2">
                {jobs.upcoming.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
