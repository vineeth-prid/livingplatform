import { useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, CalendarClock, FileSignature, Wrench } from 'lucide-react';
import { formatDate } from '@living/utils';
import type { Asset } from '@living/types';
import { Skeleton } from '@living/ui';

import { DetailSection, Field, FieldGrid } from '../master-data';
import { StatusPill } from '../operations';
import { WO_TONES } from '../work-orders/config';
import { AmcStatusBadge } from '../amc/amc-badges';
import { PlanStatusBadge } from '../maintenance/maintenance-badges';
import { frequencyLabel } from '../maintenance/config';
import { ConditionPill, CriticalityPill, WarrantyIndicator } from './asset-badges';
import { assetLocation } from './location';
import { useAssetRelations } from './relations';

/** A calm, information-dense overview: identity, lifecycle, warranty, relationships. */
export function AssetOverview({ asset }: { asset: Asset }) {
  return (
    <div className="flex flex-col gap-6">
      <DetailSection title="Details">
        <FieldGrid cols={3}>
          <Field label="Manufacturer" value={asset.manufacturer} />
          <Field label="Model" value={asset.model} />
          <Field label="Serial number" value={asset.serialNumber} mono />
          <Field label="Barcode" value={asset.barcode} mono />
          <Field label="QR code" value={asset.qrCode} mono />
          <Field label="Location" value={assetLocation(asset)} />
          <Field label="Criticality" value={<CriticalityPill value={asset.criticality} />} />
          <Field label="Condition" value={<ConditionPill value={asset.condition} />} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Lifecycle">
        <FieldGrid cols={3}>
          <Field label="Purchase date" value={asset.purchaseDate ? formatDate(asset.purchaseDate) : null} />
          <Field label="Installation date" value={asset.installationDate ? formatDate(asset.installationDate) : null} />
          <Field label="Expected life" value={asset.expectedLifeMonths ? `${asset.expectedLifeMonths} months` : null} />
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Warranty">
        <div className="flex items-center gap-4">
          <WarrantyIndicator expiry={asset.warrantyExpiry} />
          <span className="text-sm text-muted">
            {asset.warrantyExpiry ? `Expires ${formatDate(asset.warrantyExpiry)}` : 'No warranty recorded'}
          </span>
        </div>
      </DetailSection>

      <AssetRelationships asset={asset} />
    </div>
  );
}

/** Live PM / AMC / work-order relationships (replaces the Sprint-7 placeholders). */
function AssetRelationships({ asset }: { asset: Asset }) {
  const navigate = useNavigate();
  const { plans, plansTotal, contracts, contractsTotal, workOrders, loading } = useAssetRelations(asset);
  const activeContract = contracts.find((c) => c.status === 'ACTIVE') ?? contracts[0];

  return (
    <DetailSection title="Relationships">
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {/* Preventive maintenance */}
          <RelationCard icon={CalendarClock} label="Preventive maintenance" count={plansTotal}
            onOpen={() => navigate({ to: '/maintenance', search: { assetId: asset.id } as never })}>
            {plans.length === 0 ? <Empty>No maintenance plans.</Empty> : plans.slice(0, 3).map((p) => (
              <RelRow key={p.id} onClick={() => navigate({ to: `/maintenance/${p.id}` })}
                title={p.name} subtitle={frequencyLabel(p.frequencyType, p.frequencyInterval, p.cronExpression)} trailing={<PlanStatusBadge isActive={p.isActive} />} />
            ))}
          </RelationCard>

          {/* AMC coverage */}
          <RelationCard icon={FileSignature} label="AMC coverage" count={contractsTotal}
            onOpen={activeContract ? () => navigate({ to: `/amc/${activeContract.id}` }) : undefined}>
            {contracts.length === 0 ? <Empty>Not covered by a contract.</Empty> : contracts.slice(0, 3).map((c) => (
              <RelRow key={c.id} onClick={() => navigate({ to: `/amc/${c.id}` })}
                title={c.name} subtitle={c.vendor?.name ?? c.contractNumber} trailing={<AmcStatusBadge status={c.status} />} />
            ))}
          </RelationCard>

          {/* Related work orders */}
          <RelationCard icon={Wrench} label="Work orders" count={workOrders.length}>
            {workOrders.length === 0 ? <Empty>No related work orders.</Empty> : workOrders.slice(0, 3).map((w) => (
              <RelRow key={w.id} onClick={() => navigate({ to: `/work-orders/${w.id}` })}
                title={w.title} subtitle={w.workOrderNumber} trailing={<StatusPill status={w.status} tones={WO_TONES} />} />
            ))}
          </RelationCard>
        </div>
      )}
    </DetailSection>
  );
}

function RelationCard({ icon: Icon, label, count, onOpen, children }: {
  icon: typeof CalendarClock; label: string; count?: number; onOpen?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-border-subtle bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-body"><Icon className="h-4 w-4 text-subtle" /> {label}{count != null && count > 0 && <span className="rounded-full bg-sunken px-1.5 text-2xs text-muted">{count}</span>}</span>
        {onOpen && <button onClick={onOpen} aria-label={`Open ${label}`} className="text-subtle transition-colors hover:text-brand"><ArrowUpRight className="h-4 w-4" /></button>}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-subtle">{children}</p>;

function RelRow({ title, subtitle, trailing, onClick }: { title: string; subtitle: string; trailing: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-sunken">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-strong">{title}</span>
        <span className="block truncate text-xs text-subtle">{subtitle}</span>
      </span>
      {trailing}
    </button>
  );
}
