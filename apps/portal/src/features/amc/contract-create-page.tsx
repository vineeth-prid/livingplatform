import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { EmptyState, PageContainer, PageHeader, PageTransition, toast } from '@living/ui';

import { useCommunity } from '../community/community-context';
import { ContractForm } from './contract-form';
import { useContractMutations, useVendorOptions } from './queries';

export function ContractCreatePage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { create } = useContractMutations();
  const vendorsQ = useVendorOptions(!!communityId);
  const vendors = (vendorsQ.data?.items ?? []).map((v) => ({ value: v.id, label: v.name }));

  if (!hasPermission('amc:create')) {
    return <PageContainer><EmptyState title="No access" description="You don’t have permission to create AMC contracts." /></PageContainer>;
  }

  async function onSubmit(body: Record<string, unknown>) {
    if (!communityId) return;
    try {
      const contract = await create.mutateAsync({ communityId, ...body });
      toast.success('Contract created');
      navigate({ to: `/amc/${contract.id}` });
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not create the contract');
    }
  }

  return (
    <PageTransition>
      <PageContainer size="md">
        <Link to={'/amc' as string} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-body">
          <ArrowLeft className="h-4 w-4" /> AMC contracts
        </Link>
        <PageHeader eyebrow="AMC management" title="New contract" description="Record a maintenance contract with a vendor." />
        {communityId ? (
          <ContractForm mode="create" vendors={vendors} submitting={create.isPending} onSubmit={onSubmit} onCancel={() => navigate({ to: '/amc' })} />
        ) : (
          <EmptyState title="Select a community" description="Choose a community from the switcher to add a contract." />
        )}
      </PageContainer>
    </PageTransition>
  );
}
