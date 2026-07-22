import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Car, History, ListTree, Pencil, Trash2, UserRound } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { formatDateTime, timeAgo } from '@living/utils';
import {
  Button, Card, EmptyState, LoadingState, PageContainer, PageTransition,
  Timeline, type TimelineItem, toast, useConfirm,
} from '@living/ui';

import { useCommunity } from '../community/community-context';
import { DetailSection, Field, FieldGrid } from '../master-data';
import { Tabs, type TabDef } from '../shared/tabs';
import { VisitorStatusBadge, VisitorTypeBadge, useResidentOptions, useVisitor, useVisitorMutations } from './lib';
import { VisitorActions } from './visitor-actions';
import { VisitorForm } from './visitor-form';

export function VisitorDetailPage() {
  const { visitorId } = useParams({ strict: false }) as { visitorId: string };
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const q = useVisitor(visitorId);
  const v = q.data;
  const { cancel } = useVisitorMutations(visitorId);
  const residentsQ = useResidentOptions(communityId);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);

  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  async function onCancel() {
    if (!v) return;
    if (!(await confirm({ title: `Cancel visit for ${v.visitorName}?`, tone: 'danger', confirmLabel: 'Cancel visit' }))) return;
    try { await cancel.mutateAsync(); toast.success('Visit cancelled'); navigate({ to: '/visitors' }); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not cancel'); }
  }

  if (q.isLoading) return <PageTransition><PageContainer><LoadingState className="h-[60vh]" /></PageContainer></PageTransition>;
  if (notFound || !v) return <PageTransition><PageContainer><EmptyState title="Visitor not found" description="This visit no longer exists." /></PageContainer></PageTransition>;

  const resident = v.resident ? `${v.resident.firstName} ${v.resident.lastName}` : '—';
  const tabs: TabDef[] = [{ key: 'overview', label: 'Overview', icon: ListTree }, { key: 'history', label: 'History', icon: History }];
  const history: TimelineItem[] = [
    v.actualCheckOut ? { id: 'out', title: 'Checked out', timestamp: timeAgo(v.actualCheckOut) } : null,
    v.actualCheckIn ? { id: 'in', title: 'Checked in', timestamp: timeAgo(v.actualCheckIn) } : null,
    { id: 'status', title: `Status: ${v.status.toLowerCase().replace(/_/g, ' ')}`, timestamp: timeAgo(v.updatedAt) },
    { id: 'created', title: 'Invited', timestamp: timeAgo(v.createdAt) },
  ].filter(Boolean) as TimelineItem[];

  return (
    <PageTransition>
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <Card variant="elevated" className="flex flex-col gap-5">
                <button onClick={() => navigate({ to: '/visitors' })} className="self-start text-sm text-muted transition-colors hover:text-body">← Visitors</button>
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tint text-brand"><UserRound className="h-6 w-6" /></span>
                  <div className="min-w-0"><h1 className="truncate font-display text-h3 leading-tight tracking-tight text-strong">{v.visitorName}</h1><p className="text-xs text-muted">{v.mobileNumber}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-2"><VisitorStatusBadge status={v.status} size="md" /><VisitorTypeBadge type={v.visitorType} /></div>
                <div className="rounded-card bg-sunken px-4 py-3 text-center">
                  <p className="text-2xs uppercase tracking-wider text-subtle">Gate pass</p>
                  <p className="font-mono text-2xl font-bold tracking-widest text-brand">{v.passCode}</p>
                </div>
                <dl className="flex flex-col gap-3 border-t border-border-subtle pt-4">
                  <Row label="Resident" value={resident} />
                  <Row label="Expected" value={formatDateTime(v.expectedArrival)} />
                  {v.vehicleNumber && <Row label="Vehicle" value={v.vehicleNumber} />}
                </dl>
                <div className="border-t border-border-subtle pt-4"><VisitorActions visitor={v} onDone={() => q.refetch()} size="md" /></div>
                {(hasPermission('visitor:update')) && (
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
                    <Button variant="ghost" onClick={onCancel} aria-label="Cancel visit"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card variant="elevated" padded={false} className="overflow-hidden">
              <div className="px-4 pt-2"><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
              <div className="p-5">
                {tab === 'overview' ? (
                  <div className="flex flex-col gap-6">
                    <DetailSection title="Visit">
                      <FieldGrid cols={2}>
                        <Field label="Purpose" value={v.purpose} />
                        <Field label="Type" value={v.visitorType.toLowerCase()} />
                        <Field label="Vehicle" value={v.vehicleNumber ? <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" /> {v.vehicleNumber}</span> : null} />
                        <Field label="Checked in" value={v.actualCheckIn ? formatDateTime(v.actualCheckIn) : null} />
                        <Field label="Checked out" value={v.actualCheckOut ? formatDateTime(v.actualCheckOut) : null} />
                        <Field label="Notes" value={v.notes} />
                      </FieldGrid>
                    </DetailSection>
                  </div>
                ) : <Timeline items={history} />}
              </div>
            </Card>
          </div>
        </div>

        {communityId && (
          <VisitorForm open={editing} onOpenChange={setEditing} communityId={communityId}
            residents={(residentsQ.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` }))}
            visitor={{ id: v.id, residentId: v.residentId, visitorName: v.visitorName, mobileNumber: v.mobileNumber, vehicleNumber: v.vehicleNumber, visitorType: v.visitorType, purpose: v.purpose, expectedArrival: v.expectedArrival, notes: v.notes }}
            onSaved={() => q.refetch()} />
        )}
      </PageContainer>
    </PageTransition>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex items-baseline justify-between gap-3"><dt className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</dt><dd className="min-w-0 truncate text-right text-sm text-body">{value ?? <span className="text-subtle">—</span>}</dd></div>;
}
