import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { EmptyState, PageContainer, PageHeader, PageTransition, toast } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { PlanForm } from './plan-form';
import { useAssetOptions, usePlanMutations } from './queries';

/** Full-page create flow at /maintenance/new. */
export function PlanCreatePage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { create } = usePlanMutations();
  const assetsQ = useAssetOptions(communityId);
  const assets = (assetsQ.data?.items ?? []).map((a) => ({ value: a.id, label: `${a.assetCode} · ${a.name}` }));

  if (!hasPermission('maintenance:create')) {
    return <PageContainer><EmptyState title="No access" description="You don’t have permission to create maintenance plans." /></PageContainer>;
  }

  async function onSubmit(body: Record<string, unknown>) {
    if (!communityId) return;
    try {
      const plan = await create.mutateAsync({ communityId, ...body });
      toast.success('Plan created');
      navigate({ to: `/maintenance/${plan.id}` });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not create the plan');
    }
  }

  return (
    <PageTransition>
      <PageContainer size="md">
        <Link to={'/maintenance' as string} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-body">
          <ArrowLeft className="h-4 w-4" /> Maintenance plans
        </Link>
        <PageHeader eyebrow="Preventive maintenance" title="New plan" description="Schedule recurring maintenance for an asset." />
        {communityId ? (
          <PlanForm mode="create" assets={assets} submitting={create.isPending} onSubmit={onSubmit} onCancel={() => navigate({ to: '/maintenance' })} />
        ) : (
          <EmptyState title="Select a community" description="Choose a community from the switcher to add a plan." />
        )}
      </PageContainer>
    </PageTransition>
  );
}
