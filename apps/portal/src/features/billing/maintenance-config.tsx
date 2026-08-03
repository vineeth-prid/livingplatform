import { useMemo, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import type { MaintenanceCharge } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import {
  Badge, Button, Card, DataTable, EmptyState, Input, LoadingState, PageContainer, PageHeader,
  Sheet, SheetContent, toast, useConfirm, type Column,
} from '@living/ui';

import { living } from '../../lib/living';
import { useCommunity } from '../community/community-context';
import { FormGrid, FormSection, FullWidth, SelectField, TextAreaField } from '../shared/form-kit';
import { inr, useBillingMutation, useMaintenanceCharges, usePropertyTypes } from './queries';

/**
 * Feature 3 — maintenance charges by property type.
 *
 * The property-type list is the community's OWN unit types (1 BHK / Villa /
 * Commercial / whatever they actually built), never a hardcoded ladder. A rate
 * revision is a new row with a future start date, so history stays intact and
 * invoices already issued keep the rate that produced them.
 */
export function MaintenanceConfigPage() {
  const { communityId } = useCommunity();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const charges = useMaintenanceCharges(communityId);
  const types = usePropertyTypes(communityId);
  const [editing, setEditing] = useState<MaintenanceCharge | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = hasPermission('billing:charge:manage');
  const remove = useBillingMutation(communityId, (cid, id: string) =>
    living.billing.deleteCharge(cid, id),
  );

  const rows = charges.data?.items ?? [];
  const unpriced = useMemo(
    () => (types.data ?? []).filter((t) => !t.configured && t.unitCount > 0),
    [types.data],
  );

  const columns: Column<MaintenanceCharge>[] = [
    {
      key: 'propertyType',
      header: 'Property type',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-strong">{c.propertyType}</p>
          {c.current && (
            <Badge tone="brand" size="sm" dot>
              In force
            </Badge>
          )}
        </div>
      ),
    },
    { key: 'monthly', header: 'Monthly', cell: (c) => <Money value={c.monthlyAmount} /> },
    {
      key: 'quarterly',
      header: 'Quarterly',
      cell: (c) => <Money value={c.quarterlyAmount} fallback={c.monthlyAmount * 3} />,
    },
    {
      key: 'yearly',
      header: 'Yearly',
      cell: (c) => <Money value={c.yearlyAmount} fallback={c.monthlyAmount * 12} />,
    },
    {
      key: 'late',
      header: 'Late fee',
      cell: (c) => (
        <span className="text-sm text-body">
          {c.lateFeeAmount > 0 ? inr(c.lateFeeAmount) : ''}
          {c.lateFeeAmount > 0 && c.lateFeePercent > 0 ? ' + ' : ''}
          {c.lateFeePercent > 0 ? `${c.lateFeePercent}%` : ''}
          {c.lateFeeAmount === 0 && c.lateFeePercent === 0 ? '—' : ''}
          {c.gracePeriodDays > 0 && (
            <span className="block text-xs text-subtle">after {c.gracePeriodDays} days grace</span>
          )}
        </span>
      ),
    },
    {
      key: 'effective',
      header: 'Effective',
      cell: (c) => (
        <span className="text-sm text-body">
          {new Date(c.effectiveFrom).toLocaleDateString()}
          {c.effectiveTo && (
            <span className="block text-xs text-subtle">
              until {new Date(c.effectiveTo).toLocaleDateString()}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) =>
        canManage ? (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete the ${c.propertyType} rate`}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: `Delete the ${c.propertyType} rate?`,
                    description: 'Invoices already issued keep the amount they were billed at.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  }))
                )
                  return;
                await remove.mutateAsync(c.id);
                toast.success('Rate deleted');
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  if (charges.isLoading) return <LoadingState label="Loading maintenance charges…" />;

  return (
    <PageContainer>
      <PageHeader
        title="Maintenance charges"
        description="What each property type pays, and from when. Add a rate with a future start date to schedule a revision."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Add rate
            </Button>
          ) : null
        }
      />

      {unpriced.length > 0 && (
        <Card variant="elevated" className="mb-6 flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" />
          <div>
            <p className="text-sm font-medium text-strong">
              {unpriced.length} property {unpriced.length === 1 ? 'type has' : 'types have'} no rate
              yet
            </p>
            <p className="mt-0.5 text-sm text-muted">
              Units of {unpriced.map((t) => `${t.type} (${t.unitCount})`).join(', ')} will be skipped
              when invoices are generated.
            </p>
          </div>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No maintenance charges yet"
          description="Set a monthly amount for each property type to start billing."
          action={
            canManage ? <Button onClick={() => setCreating(true)}>Add the first rate</Button> : undefined
          }
        />
      ) : (
        <Card variant="elevated" className="p-0">
          <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} />
        </Card>
      )}

      {communityId && (
        <ChargeDrawer
          key={editing?.id ?? 'new'}
          communityId={communityId}
          charge={editing}
          propertyTypes={(types.data ?? []).map((t) => t.type)}
          open={creating || !!editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </PageContainer>
  );
}

function Money({ value, fallback }: { value: number | null; fallback?: number }) {
  if (value === null || value === 0) {
    return fallback !== undefined ? (
      <span className="text-sm text-subtle">{inr(fallback)} (derived)</span>
    ) : (
      <span className="text-sm text-subtle">—</span>
    );
  }
  return <span className="text-sm font-medium text-strong">{inr(value)}</span>;
}

function ChargeDrawer({
  communityId,
  charge,
  propertyTypes,
  open,
  onClose,
}: {
  communityId: string;
  charge: MaintenanceCharge | null;
  propertyTypes: string[];
  open: boolean;
  onClose: () => void;
}) {
  const editing = !!charge;
  const [propertyType, setPropertyType] = useState(charge?.propertyType ?? '');
  const [customType, setCustomType] = useState('');
  const [monthly, setMonthly] = useState(charge ? String(charge.monthlyAmount) : '');
  const [quarterly, setQuarterly] = useState(charge?.quarterlyAmount ? String(charge.quarterlyAmount) : '');
  const [yearly, setYearly] = useState(charge?.yearlyAmount ? String(charge.yearlyAmount) : '');
  const [lateFee, setLateFee] = useState(charge ? String(charge.lateFeeAmount) : '0');
  const [latePercent, setLatePercent] = useState(charge ? String(charge.lateFeePercent) : '0');
  const [grace, setGrace] = useState(charge ? String(charge.gracePeriodDays) : '0');
  const [effectiveFrom, setEffectiveFrom] = useState(
    charge ? charge.effectiveFrom.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [effectiveTo, setEffectiveTo] = useState(charge?.effectiveTo?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(charge?.notes ?? '');

  const save = useBillingMutation(communityId, (cid, input: Record<string, unknown>) =>
    editing
      ? living.billing.updateCharge(cid, charge!.id, input)
      : living.billing.createCharge(cid, input),
  );

  const resolvedType = propertyType === '__custom__' ? customType.trim() : propertyType;
  const valid = resolvedType.length > 0 && Number(monthly) > 0 && effectiveFrom.length > 0;

  async function onSubmit() {
    try {
      await save.mutateAsync({
        propertyType: resolvedType,
        monthlyAmount: Number(monthly),
        quarterlyAmount: quarterly ? Number(quarterly) : undefined,
        yearlyAmount: yearly ? Number(yearly) : undefined,
        lateFeeAmount: Number(lateFee || 0),
        lateFeePercent: Number(latePercent || 0),
        gracePeriodDays: Number(grace || 0),
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
        notes: notes || undefined,
      });
      toast.success(editing ? 'Rate updated' : 'Rate added');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const typeOptions = [
    ...propertyTypes.map((t) => ({ value: t, label: t })),
    { value: '__custom__', label: 'Another property type…' },
  ];

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent open={open} title={editing ? `Edit ${charge!.propertyType} rate` : 'Add a maintenance rate'}>
        <div className="space-y-6">
          <FormSection
            title="Property type"
            description="Types come from the units in this community. Pick one, or name a new one."
          >
            <FormGrid>
              <SelectField
                label="Property type"
                value={propertyType}
                onChange={setPropertyType}
                options={typeOptions}
                placeholder="Select a type…"
                required
              />
              {propertyType === '__custom__' && (
                <Input
                  label="New property type"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="e.g. Penthouse"
                />
              )}
            </FormGrid>
          </FormSection>

          <FormSection
            title="Amounts"
            description="Quarterly and yearly are optional — leave blank and they derive from the monthly rate (×3 / ×12)."
          >
            <FormGrid>
              <Input
                label="Monthly amount (₹)"
                type="number"
                inputMode="decimal"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                required
              />
              <Input
                label="Quarterly amount (₹)"
                type="number"
                inputMode="decimal"
                value={quarterly}
                onChange={(e) => setQuarterly(e.target.value)}
                hint={monthly ? `Derives to ${inr(Number(monthly) * 3)}` : undefined}
              />
              <Input
                label="Yearly amount (₹)"
                type="number"
                inputMode="decimal"
                value={yearly}
                onChange={(e) => setYearly(e.target.value)}
                hint={monthly ? `Derives to ${inr(Number(monthly) * 12)}` : undefined}
              />
            </FormGrid>
          </FormSection>

          <FormSection title="Late payment" description="Charged once the grace period after the due date has passed.">
            <FormGrid>
              <Input
                label="Flat late fee (₹)"
                type="number"
                inputMode="decimal"
                value={lateFee}
                onChange={(e) => setLateFee(e.target.value)}
              />
              <Input
                label="Late fee (% of the bill)"
                type="number"
                inputMode="decimal"
                value={latePercent}
                onChange={(e) => setLatePercent(e.target.value)}
              />
              <Input
                label="Grace period (days)"
                type="number"
                inputMode="numeric"
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
              />
            </FormGrid>
          </FormSection>

          <FormSection
            title="Effective dates"
            description="A start date in the future schedules a revision — it takes over automatically when that period is billed."
          >
            <FormGrid>
              <Input
                label="Effective from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
              <Input
                label="Effective until (optional)"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
              />
              <FullWidth>
                <TextAreaField label="Notes" value={notes} onChange={setNotes} />
              </FullWidth>
            </FormGrid>
          </FormSection>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={!valid} loading={save.isPending}>
              {editing ? 'Save rate' : 'Add rate'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
