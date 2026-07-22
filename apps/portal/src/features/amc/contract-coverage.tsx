import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus, Trash2 } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, EmptyState, Skeleton, toast, useConfirm } from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';
import { AssetStatusBadge } from '../assets/asset-badges';
import { CoverageTypeBadge } from './amc-badges';
import { COVERAGE_TYPE, humanize } from './config';
import { useContractMutations, useCoverages } from './queries';

/** Covered assets — reuses asset badges; rows open the asset. Managers add/remove. */
export function ContractCoverage({ contractId }: { contractId: string }) {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const q = useCoverages(contractId);
  const { addCoverage, removeCoverage } = useContractMutations(contractId);
  const canManage = hasPermission('amc:coverage:manage');

  const assetsQ = useQuery({
    queryKey: ['assets', communityId, 'options'],
    queryFn: () => living.assets.list({ communityId: communityId!, limit: 200, sortBy: 'name', sortDir: 'asc' }),
    enabled: !!communityId && canManage,
  });

  const [assetId, setAssetId] = useState('');
  const [coverageType, setCoverageType] = useState('FULL');
  const covered = new Set((q.data ?? []).map((c) => c.assetId));
  const available = (assetsQ.data?.items ?? []).filter((a) => !covered.has(a.id));

  async function add() {
    if (!assetId) return;
    try {
      await addCoverage.mutateAsync({ assetId, coverageType });
      setAssetId(''); setCoverageType('FULL');
      toast.success('Asset covered');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add coverage');
    }
  }
  async function remove(id: string) {
    if (!(await confirm({ title: 'Remove asset from contract?', tone: 'danger', confirmLabel: 'Remove' }))) return;
    try { await removeCoverage.mutateAsync(id); toast.success('Coverage removed'); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not remove'); }
  }

  return (
    <div className="flex flex-col gap-4">
      {q.isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-card" />)}</div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={Package} title="No covered assets" description="Add the assets this contract protects." />
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-card border border-border-subtle">
          {(q.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
              <button onClick={() => navigate({ to: `/assets/${c.assetId}` })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-tint text-brand"><Package className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-strong">{c.asset?.name ?? c.assetId}</p>
                  <p className="truncate font-mono text-xs text-subtle">{c.asset?.assetCode}</p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <CoverageTypeBadge type={c.coverageType} />
                {c.asset?.status && <AssetStatusBadge status={c.asset.status} />}
                {canManage && (
                  <button onClick={() => remove(c.assetId)} aria-label="Remove coverage" className="rounded-md p-1.5 text-subtle transition-colors hover:bg-sunken hover:text-danger-fg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-wrap items-end gap-3 rounded-card border border-border-subtle bg-sunken/40 p-3">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Add asset</span>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="h-11 rounded-control border border-border bg-raised px-3 text-base text-strong outline-none focus-visible:shadow-ring">
              <option value="">{available.length ? 'Select an asset' : 'All assets covered'}</option>
              {available.map((a) => <option key={a.id} value={a.id}>{a.assetCode} · {a.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Coverage</span>
            <select value={coverageType} onChange={(e) => setCoverageType(e.target.value)} className="h-11 rounded-control border border-border bg-raised px-3 text-base text-strong outline-none focus-visible:shadow-ring">
              {COVERAGE_TYPE.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </label>
          <Button onClick={add} loading={addCoverage.isPending} disabled={!assetId}><Plus className="h-4 w-4" /> Cover asset</Button>
        </div>
      )}
    </div>
  );
}
