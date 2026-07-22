import { useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { timeAgo } from '@living/utils';
import { Badge, type BadgeProps, Card, EmptyState, Sheet, SheetContent, Skeleton } from '@living/ui';
import { cn } from '@living/utils';
import type { Announcement } from '@living/types';

import { useAnnouncements } from '../community-ops';
import { ScreenHeader } from '../shell';

type Tone = NonNullable<BadgeProps['tone']>;
const TONE: Record<string, Tone> = { LOW: 'neutral', NORMAL: 'info', HIGH: 'warning', CRITICAL: 'danger' };
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();

export function AnnouncementsScreen() {
  const { data, isLoading } = useAnnouncements();
  const [active, setActive] = useState<Announcement | null>(null);
  const [filter, setFilter] = useState<'all' | 'CRITICAL' | 'HIGH'>('all');
  const items = useMemo(() => (data?.items ?? []).filter((a) => filter === 'all' || a.priority === filter), [data, filter]);

  return (
    <div>
      <ScreenHeader title="Announcements" subtitle="Living" />
      <div className="flex gap-1.5 px-4">
        {([['all', 'All'], ['HIGH', 'Important'], ['CRITICAL', 'Urgent']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn('rounded-pill px-3 py-1.5 text-sm font-medium transition-colors', filter === v ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted')}>{label}</button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2 px-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)
        ) : items.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements" description="Community notices will appear here." />
        ) : (
          items.map((a) => (
            <button key={a.id} onClick={() => setActive(a)} className="rounded-card bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between gap-2"><p className="truncate font-medium text-strong">{a.title}</p><Badge tone={TONE[a.priority] ?? 'neutral'} size="sm" dot>{humanize(a.priority)}</Badge></div>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{a.content}</p>
              {a.publishAt && <p className="mt-1.5 text-2xs text-subtle">{timeAgo(a.publishAt)}</p>}
            </button>
          ))
        )}
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent open={!!active} side="bottom" title={active?.title ?? ''} className="max-h-[80dvh]">
          {active && (
            <div className="flex flex-col gap-3">
              <Badge tone={TONE[active.priority] ?? 'neutral'} size="sm" dot>{humanize(active.priority)}</Badge>
              <Card variant="elevated"><p className="whitespace-pre-wrap text-sm text-body">{active.content}</p></Card>
              {active.publishAt && <p className="text-xs text-subtle">Posted {timeAgo(active.publishAt)}</p>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
