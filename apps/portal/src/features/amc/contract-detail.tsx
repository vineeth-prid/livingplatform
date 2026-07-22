import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { FileSignature, Gauge, History, ListTree, Package, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { formatDate } from '@living/utils';
import {
  Button, Card, EmptyState, Input, LoadingState, PageContainer, PageTransition,
  Sheet, SheetContent, toast, useConfirm,
} from '@living/ui';
import type { AMCContract } from '@living/types';

import { useCommunity } from '../community/community-context';
import { Tabs, type TabDef } from '../shared/tabs';
import { formatMoney } from './config';
import { AmcStatusBadge, RenewalIndicator } from './amc-badges';
import { ContractCoverage } from './contract-coverage';
import { ContractForm, type ContractValues } from './contract-form';
import { ContractHistory } from './contract-history';
import { ContractOverview } from './contract-overview';
import { ContractSla } from './contract-sla';
import { useContract, useContractMutations, useVendorOptions } from './queries';

const dateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

export function ContractDetailPage() {
  const { contractId } = useParams({ strict: false }) as { contractId: string };
  const search = useSearch({ strict: false }) as { edit?: number };
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const q = useContract(contractId);
  const contract = q.data;
  const { remove } = useContractMutations(contractId);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => { if (search.edit && hasPermission('amc:update')) setEditing(true); }, [search.edit, hasPermission]);
  const notFound = q.isError && q.error instanceof LivingApiError && q.error.isNotFound;

  async function onDelete() {
    if (!contract) return;
    if (!(await confirm({ title: `Delete ${contract.contractNumber}?`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try { await remove.mutateAsync(); toast.success('Contract deleted'); navigate({ to: '/amc' }); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not delete'); }
  }

  if (q.isLoading) return <PageTransition><PageContainer><LoadingState className="h-[60vh]" /></PageContainer></PageTransition>;
  if (notFound || !contract) return <PageTransition><PageContainer><EmptyState title="Contract not found" description="This AMC contract no longer exists." /></PageContainer></PageTransition>;

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview', icon: ListTree },
    { key: 'coverage', label: 'Covered assets', icon: Package, count: contract._count?.coverages ?? contract.coverages?.length },
    { key: 'sla', label: 'SLA', icon: Gauge, count: contract.slaRules?.length },
    { key: 'history', label: 'History', icon: History },
  ];

  return (
    <PageTransition>
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <Card variant="elevated" className="flex flex-col gap-5">
                <Link to={'/amc' as string} className="self-start text-sm text-muted transition-colors hover:text-body">← Contracts</Link>
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tint text-brand"><FileSignature className="h-6 w-6" /></span>
                  <div className="min-w-0">
                    <h1 className="truncate font-display text-h3 leading-tight tracking-tight text-strong">{contract.name}</h1>
                    <p className="font-mono text-xs text-muted">{contract.contractNumber}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AmcStatusBadge status={contract.status} size="md" />
                  <RenewalIndicator status={contract.status} endDate={contract.endDate} />
                </div>
                <dl className="flex flex-col gap-3 border-t border-border-subtle pt-4">
                  <Row label="Vendor" value={contract.vendor?.name} />
                  <Row label="Annual cost" value={formatMoney(contract.annualCost, contract.currency)} />
                  <Row label="Expiry" value={formatDate(contract.endDate)} />
                </dl>
                <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
                  {hasPermission('amc:renew') && <Button variant="secondary" onClick={() => setRenewing(true)}><RefreshCw className="h-4 w-4" /> Renew</Button>}
                  <div className="flex gap-2">
                    {hasPermission('amc:update') && <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
                    {hasPermission('amc:delete') && <Button variant="ghost" onClick={onDelete} aria-label="Delete contract"><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card variant="elevated" padded={false} className="overflow-hidden">
              <div className="px-4 pt-2"><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
              <div className="p-5">
                {tab === 'overview' && <ContractOverview contract={contract} />}
                {tab === 'coverage' && <ContractCoverage contractId={contract.id} />}
                {tab === 'sla' && <ContractSla contractId={contract.id} rules={contract.slaRules ?? []} onChanged={() => q.refetch()} />}
                {tab === 'history' && <ContractHistory contractId={contract.id} />}
              </div>
            </Card>
          </div>
        </div>

        <ContractEditDrawer contract={contract} open={editing} onOpenChange={setEditing} onSaved={() => q.refetch()} />
        <RenewDrawer contract={contract} open={renewing} onOpenChange={setRenewing} onSaved={() => q.refetch()} />
      </PageContainer>
    </PageTransition>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-body">{value ?? <span className="text-subtle">—</span>}</dd>
    </div>
  );
}

function ContractEditDrawer({ contract, open, onOpenChange, onSaved }: {
  contract: AMCContract; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { communityId } = useCommunity();
  const vendorsQ = useVendorOptions(!!communityId && open);
  const { update } = useContractMutations(contract.id);

  const initial: Partial<ContractValues> = {
    name: contract.name, contractNumber: contract.contractNumber, description: contract.description ?? '',
    vendorId: contract.vendorId, status: contract.status, startDate: dateInput(contract.startDate), endDate: dateInput(contract.endDate),
    renewalReminderDays: String(contract.renewalReminderDays), annualCost: String(contract.annualCost),
    currency: contract.currency, paymentFrequency: contract.paymentFrequency,
    contactPerson: contract.contactPerson ?? '', contactPhone: contract.contactPhone ?? '', contactEmail: contract.contactEmail ?? '',
    notes: contract.notes ?? '', autoRenew: contract.autoRenew ? 'true' : '',
  };

  async function onSubmit(body: Record<string, unknown>) {
    try { await update.mutateAsync(body); toast.success('Contract updated'); onOpenChange(false); onSaved(); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not save'); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="right" title={`Edit ${contract.contractNumber}`} className="w-[min(96vw,640px)]">
        <ContractForm mode="edit" initial={initial}
          vendors={(vendorsQ.data?.items ?? []).map((v) => ({ value: v.id, label: v.name }))}
          submitting={update.isPending} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function RenewDrawer({ contract, open, onOpenChange, onSaved }: {
  contract: AMCContract; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { renew } = useContractMutations(contract.id);
  const [endDate, setEndDate] = useState('');
  const [annualCost, setAnnualCost] = useState('');

  async function submit() {
    if (!endDate) { toast.error('Choose a new end date'); return; }
    try {
      await renew.mutateAsync({ endDate: new Date(endDate).toISOString(), ...(annualCost ? { annualCost: Number(annualCost) } : {}) });
      toast.success('Contract renewed');
      onOpenChange(false); onSaved(); setEndDate(''); setAnnualCost('');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not renew');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="right" title={`Renew ${contract.contractNumber}`} description="Open a new term. The new start defaults to the current end date." className="w-[min(94vw,460px)]">
        <div className="flex flex-col gap-4">
          <Input label="New end date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          <Input label="Revised annual cost (optional)" type="number" value={annualCost} onChange={(e) => setAnnualCost(e.target.value)} placeholder={String(contract.annualCost)} />
          <div className="mt-2 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} loading={renew.isPending} disabled={!endDate}>Renew contract</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
