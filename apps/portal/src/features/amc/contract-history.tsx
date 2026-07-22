import { History } from 'lucide-react';
import { timeAgo } from '@living/utils';
import { EmptyState, Skeleton, Timeline, type TimelineItem } from '@living/ui';

import { humanize } from './config';
import { useContractHistory } from './queries';

/** Contract audit timeline (created / updated / renewed / expired / coverage …), newest first. */
export function ContractHistory({ contractId }: { contractId: string }) {
  const q = useContractHistory(contractId);
  if (q.isLoading) return <Skeleton className="h-24" />;
  const events = [...(q.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (events.length === 0) return <EmptyState icon={History} title="No history yet" description="Contract changes will appear here." />;
  const items: TimelineItem[] = events.map((e) => ({ id: e.id, title: e.description ?? humanize(e.eventType), timestamp: timeAgo(e.createdAt) }));
  return <Timeline items={items} />;
}
