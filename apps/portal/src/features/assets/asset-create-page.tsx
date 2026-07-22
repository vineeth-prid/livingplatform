import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { EmptyState, PageContainer, PageHeader, PageTransition, toast } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { AssetForm } from './asset-form';
import { useAssetCategories, useAssetMutations, useLocationOptions } from './queries';

/** Full-page multi-section create flow at /assets/new. */
export function AssetCreatePage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { create } = useAssetMutations();
  const categoriesQ = useAssetCategories(communityId);
  const { blocks, floors } = useLocationOptions(communityId);

  const categories = (categoriesQ.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
  const blockOpts = blocks.map((b) => ({ value: b.id, label: b.name }));
  const floorOpts = floors.map((f) => ({ value: f.id, label: f.name ?? `Level ${f.level}` }));

  if (!hasPermission('asset:create')) {
    return (
      <PageContainer>
        <EmptyState title="No access" description="You don’t have permission to create assets." />
      </PageContainer>
    );
  }

  async function onSubmit(body: Record<string, unknown>) {
    if (!communityId) return;
    try {
      const asset = await create.mutateAsync({ communityId, ...body });
      toast.success('Asset created');
      navigate({ to: `/assets/${asset.id}` });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not create the asset');
    }
  }

  return (
    <PageTransition>
      <PageContainer size="md">
        <Link to={'/assets' as string} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-body">
          <ArrowLeft className="h-4 w-4" /> Asset register
        </Link>
        <PageHeader eyebrow="Assets" title="New asset" description="Register a physical asset in this community." />
        {communityId ? (
          <AssetForm
            mode="create"
            options={{ categories, blocks: blockOpts, floors: floorOpts }}
            submitting={create.isPending}
            onSubmit={onSubmit}
            onCancel={() => navigate({ to: '/assets' })}
          />
        ) : (
          <EmptyState title="Select a community" description="Choose a community from the switcher to add an asset." />
        )}
      </PageContainer>
    </PageTransition>
  );
}
