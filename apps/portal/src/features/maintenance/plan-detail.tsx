import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  CalendarClock, CheckSquare, Hammer, History, ListTree, Pause, Play, Repeat, Sparkles, Trash2, Pencil,
} from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { formatDate, timeAgo } from '@living/utils';
import {
  Button, Card, EmptyState, LoadingState, PageContainer, PageTransition,
  Sheet, SheetContent, Timeline, type TimelineItem, toast, useConfirm,
} from '@living/ui';
import type { MaintenancePlan } from '@living/types';

import { useCommunity } from '../community/community-context';
import { PriorityPill } from '../operations';
import { Tabs, type TabDef } from '../shared/tabs';
import { frequencyLabel } from './config';
import { NextRunIndicator, PlanStatusBadge } from './maintenance-badges';
import { PlanChecklist } from './plan-checklist';
import { PlanForm, type PlanValues } from './plan-form';
import { PlanOverview } from './plan-overview';
import { PlanRuns } from './plan-runs';
import { PlanWorkOrders } from './plan-work-orders';
import { usePlan, usePlanMutations, useAssetOptions } from './queries';

const dateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

export function PlanDetailPage() {
  const { planId } = useParams({ strict: false }) as { planId: string };
  const search = useSearch({ strict: false }) as { edit?: number };
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const q = usePlan(planId);
  const plan = q.data;
  const { pause, resume, generateNow, remove } = usePlanMutations(planId);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (search.edit && hasPermission('maintenance:update')) setEditing(true); }, [search.edit, hasPermission]);

  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  async function onGenerate() {
    try { await generateNow.mutateAsync(); toast.success('Work order generated'); setTab('runs'); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not generate'); }
  }
  async function onToggle() {
    if (!plan) return;
    try {
      if (plan.isActive) { await pause.mutateAsync(); toast.success('Plan paused'); }
      else { await resume.mutateAsync(); toast.success('Plan resumed'); }
    } catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not update'); }
  }
  async function onDelete() {
    if (!plan) return;
    if (!(await confirm({ title: `Delete “${plan.name}”?`, description: 'This stops all future generation.', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try { await remove.mutateAsync(); toast.success('Plan deleted'); navigate({ to: '/maintenance' }); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not delete'); }
  }

  if (q.isLoading) return <PageTransition><PageContainer><LoadingState className="h-[60vh]" /></PageContainer></PageTransition>;
  if (notFound || !plan) return <PageTransition><PageContainer><EmptyState title="Plan not found" description="This maintenance plan no longer exists." /></PageContainer></PageTransition>;

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview', icon: ListTree },
    { key: 'checklist', label: 'Checklist', icon: CheckSquare, count: plan.checklistTemplates?.length },
    { key: 'runs', label: 'Runs', icon: Repeat },
    { key: 'work-orders', label: 'Work orders', icon: Hammer },
    { key: 'history', label: 'History', icon: History },
  ];

  const history: TimelineItem[] = [
    plan.lastRunAt ? { id: 'last', title: 'Last generated', timestamp: timeAgo(plan.lastRunAt) } : null,
    { id: 'updated', title: 'Last updated', timestamp: timeAgo(plan.updatedAt) },
    { id: 'created', title: 'Plan created', timestamp: timeAgo(plan.createdAt) },
  ].filter(Boolean) as TimelineItem[];

  return (
    <PageTransition>
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <Card variant="elevated" className="flex flex-col gap-5">
                <Link to={'/maintenance' as string} className="self-start text-sm text-muted transition-colors hover:text-body">← Plans</Link>
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tint text-brand"><CalendarClock className="h-6 w-6" /></span>
                  <div className="min-w-0">
                    <h1 className="truncate font-display text-h3 leading-tight tracking-tight text-strong">{plan.name}</h1>
                    <p className="truncate text-xs text-muted">{plan.asset ? `${plan.asset.assetCode} · ${plan.asset.name}` : 'Asset'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PlanStatusBadge isActive={plan.isActive} size="md" />
                  <PriorityPill priority={plan.priority} />
                </div>
                <dl className="flex flex-col gap-3 border-t border-border-subtle pt-4">
                  <Row label="Frequency" value={frequencyLabel(plan.frequencyType, plan.frequencyInterval, plan.cronExpression)} />
                  <Row label="Next run" node={<NextRunIndicator nextRunAt={plan.nextRunAt} isActive={plan.isActive} label={plan.isActive ? formatDate(plan.nextRunAt) : 'Paused'} />} />
                  <Row label="Last run" value={plan.lastRunAt ? formatDate(plan.lastRunAt) : '—'} />
                </dl>

                <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
                  {hasPermission('maintenance:generate') && (
                    <Button variant="secondary" onClick={onGenerate} loading={generateNow.isPending} disabled={!plan.isActive}>
                      <Sparkles className="h-4 w-4" /> Generate now
                    </Button>
                  )}
                  <div className="flex gap-2">
                    {hasPermission('maintenance:update') && (
                      <>
                        <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
                        <Button variant="ghost" onClick={onToggle} loading={pause.isPending || resume.isPending} aria-label={plan.isActive ? 'Pause' : 'Resume'}>
                          {plan.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                    {hasPermission('maintenance:delete') && (
                      <Button variant="ghost" onClick={onDelete} aria-label="Delete plan"><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card variant="elevated" padded={false} className="overflow-hidden">
              <div className="px-4 pt-2"><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
              <div className="p-5">
                {tab === 'overview' && <PlanOverview plan={plan} />}
                {tab === 'checklist' && <PlanChecklist planId={plan.id} items={plan.checklistTemplates ?? []} onChanged={() => q.refetch()} />}
                {tab === 'runs' && <PlanRuns planId={plan.id} />}
                {tab === 'work-orders' && <PlanWorkOrders planId={plan.id} />}
                {tab === 'history' && <Timeline items={history} />}
              </div>
            </Card>
          </div>
        </div>

        <PlanEditDrawer plan={plan} open={editing} onOpenChange={setEditing} onSaved={() => q.refetch()} />
      </PageContainer>
    </PageTransition>
  );
}

function Row({ label, value, node }: { label: string; value?: string; node?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-body">{node ?? value ?? <span className="text-subtle">—</span>}</dd>
    </div>
  );
}

function PlanEditDrawer({ plan, open, onOpenChange, onSaved }: {
  plan: MaintenancePlan; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { communityId } = useCommunity();
  const assetsQ = useAssetOptions(communityId ?? plan.communityId);
  const { update } = usePlanMutations(plan.id);

  const initial: Partial<PlanValues> = {
    name: plan.name, description: plan.description ?? '', assetId: plan.assetId,
    frequencyType: plan.frequencyType, frequencyInterval: String(plan.frequencyInterval),
    cronExpression: plan.cronExpression ?? '', startDate: dateInput(plan.startDate), endDate: dateInput(plan.endDate),
    priority: plan.priority, estimatedDurationMinutes: plan.estimatedDurationMinutes != null ? String(plan.estimatedDurationMinutes) : '',
    requiresVerification: plan.requiresVerification ? 'true' : '',
  };

  async function onSubmit(body: Record<string, unknown>) {
    try { await update.mutateAsync(body); toast.success('Plan updated'); onOpenChange(false); onSaved(); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not save'); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="right" title={`Edit ${plan.name}`} className="w-[min(96vw,640px)]">
        <PlanForm mode="edit" initial={initial}
          assets={(assetsQ.data?.items ?? []).map((a) => ({ value: a.id, label: `${a.assetCode} · ${a.name}` }))}
          submitting={update.isPending} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
