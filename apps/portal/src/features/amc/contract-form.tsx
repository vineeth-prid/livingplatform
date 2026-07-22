import { useEffect, useMemo, useState } from 'react';
import { Input } from '@living/ui';

import {
  CheckboxField, FormFooter, FormGrid, FormSection, FullWidth, SelectField, TextAreaField,
} from '../shared/form-kit';
import { AMC_STATUS, PAYMENT_FREQUENCY } from './config';

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
const optionsOf = (values: readonly string[]) => values.map((v) => ({ value: v, label: humanize(v) }));

export interface ContractValues {
  name: string; contractNumber: string; description: string; vendorId: string; status: string;
  startDate: string; endDate: string; renewalReminderDays: string;
  annualCost: string; currency: string; paymentFrequency: string;
  contactPerson: string; contactPhone: string; contactEmail: string; notes: string; autoRenew: string;
}

const KEYS: (keyof ContractValues)[] = [
  'name', 'contractNumber', 'description', 'vendorId', 'status', 'startDate', 'endDate',
  'renewalReminderDays', 'annualCost', 'currency', 'paymentFrequency', 'contactPerson',
  'contactPhone', 'contactEmail', 'notes', 'autoRenew',
];
const seed = (initial: Partial<ContractValues>): ContractValues => {
  const v = {} as ContractValues;
  for (const k of KEYS) v[k] = initial[k] ?? '';
  return v;
};

export function validateContract(v: ContractValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = 'Required';
  if (!v.contractNumber.trim()) e.contractNumber = 'Required';
  if (!v.vendorId) e.vendorId = 'Required';
  if (!v.startDate) e.startDate = 'Required';
  if (!v.endDate) e.endDate = 'Required';
  if (v.startDate && v.endDate && Date.parse(v.endDate) <= Date.parse(v.startDate)) e.endDate = 'Must be after start';
  if (!v.annualCost.trim()) e.annualCost = 'Required';
  else if (Number.isNaN(Number(v.annualCost)) || Number(v.annualCost) < 0) e.annualCost = 'Enter a valid amount';
  if (v.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.contactEmail)) e.contactEmail = 'Enter a valid email';
  return e;
}

export function toContractBody(v: ContractValues): Record<string, unknown> {
  const iso = (s: string) => (s ? new Date(s).toISOString() : undefined);
  return {
    name: v.name.trim(),
    contractNumber: v.contractNumber.trim(),
    description: v.description.trim() || undefined,
    vendorId: v.vendorId,
    status: v.status || undefined,
    startDate: iso(v.startDate),
    endDate: iso(v.endDate),
    renewalReminderDays: v.renewalReminderDays ? Number(v.renewalReminderDays) : undefined,
    annualCost: Number(v.annualCost),
    currency: v.currency.trim() || undefined,
    paymentFrequency: v.paymentFrequency || undefined,
    contactPerson: v.contactPerson.trim() || undefined,
    contactPhone: v.contactPhone.trim() || undefined,
    contactEmail: v.contactEmail.trim() || undefined,
    notes: v.notes.trim() || undefined,
    autoRenew: v.autoRenew === 'true' ? true : undefined,
  };
}

const DRAFT_KEY = 'living.contract-draft';

export function ContractForm({
  mode, vendors, initial, submitting, onSubmit, onCancel,
}: {
  mode: 'create' | 'edit';
  vendors: { value: string; label: string }[];
  initial?: Partial<ContractValues>;
  submitting?: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ContractValues>(() => {
    if (mode === 'create' && typeof window !== 'undefined') {
      const d = window.localStorage.getItem(DRAFT_KEY);
      if (d) { try { return { ...seed({}), ...JSON.parse(d) }; } catch { /* ignore */ } }
    }
    return seed(initial ?? {});
  });
  const [touched, setTouched] = useState(false);
  const errors = useMemo(() => validateContract(values), [values]);
  const set = (k: keyof ContractValues, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const err = (k: string) => (touched ? errors[k] : undefined);

  useEffect(() => {
    if (mode !== 'create') return;
    const t = setTimeout(() => window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values)), 400);
    return () => clearTimeout(t);
  }, [values, mode]);

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    if (mode === 'create') window.localStorage.removeItem(DRAFT_KEY);
    onSubmit(toContractBody(values));
  };

  return (
    <div className="flex flex-col gap-5">
      <FormSection title="General" description="Identify the contract.">
        <FormGrid>
          <Input label="Name" value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="DG sets — comprehensive AMC" error={err('name')} />
          <Input label="Contract number" value={values.contractNumber} onChange={(e) => set('contractNumber', e.target.value)} placeholder="AMC-2026-014" error={err('contractNumber')} />
          <FullWidth><TextAreaField label="Description" value={values.description} onChange={(v) => set('description', v)} /></FullWidth>
          {mode === 'create' && <SelectField label="Status" value={values.status} onChange={(v) => set('status', v)} options={optionsOf(AMC_STATUS.filter((s) => s === 'DRAFT' || s === 'ACTIVE'))} placeholder="Draft" />}
        </FormGrid>
      </FormSection>

      <FormSection title="Vendor" description="Who is responsible.">
        <FormGrid>
          <FullWidth><SelectField label="Vendor" required value={values.vendorId} onChange={(v) => set('vendorId', v)} options={vendors} placeholder="Select a vendor" error={err('vendorId')} /></FullWidth>
        </FormGrid>
      </FormSection>

      <FormSection title="Dates" description="Contract term and renewal reminder.">
        <FormGrid>
          <Input label="Start date" type="date" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} error={err('startDate')} />
          <Input label="End date" type="date" value={values.endDate} onChange={(e) => set('endDate', e.target.value)} error={err('endDate')} />
          <Input label="Renewal reminder (days)" type="number" value={values.renewalReminderDays} onChange={(e) => set('renewalReminderDays', e.target.value)} placeholder="30" />
          <CheckboxField label="Auto-renew" checked={values.autoRenew === 'true'} onChange={(c) => set('autoRenew', c ? 'true' : '')} />
        </FormGrid>
      </FormSection>

      <FormSection title="Financial" description="Cost and billing.">
        <FormGrid>
          <Input label="Annual cost" type="number" value={values.annualCost} onChange={(e) => set('annualCost', e.target.value)} placeholder="120000" error={err('annualCost')} />
          <Input label="Currency" value={values.currency} onChange={(e) => set('currency', e.target.value)} placeholder="INR" />
          <SelectField label="Payment frequency" value={values.paymentFrequency} onChange={(v) => set('paymentFrequency', v)} options={optionsOf(PAYMENT_FREQUENCY)} placeholder="Yearly" />
        </FormGrid>
      </FormSection>

      <FormSection title="Contact" description="Vendor point of contact (optional).">
        <FormGrid>
          <Input label="Contact person" value={values.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
          <Input label="Phone" type="tel" value={values.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          <Input label="Email" type="email" value={values.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} error={err('contactEmail')} />
          <FullWidth><TextAreaField label="Notes" value={values.notes} onChange={(v) => set('notes', v)} /></FullWidth>
        </FormGrid>
      </FormSection>

      {mode === 'create' && (
        <div className="rounded-card border border-dashed border-border p-4 text-sm text-subtle">
          Covered assets and SLA rules are managed from the contract’s page once it’s created.
        </div>
      )}

      <FormFooter submitLabel={mode === 'create' ? 'Create contract' : 'Save changes'} submitting={submitting}
        disabled={touched && Object.keys(errors).length > 0} onSubmit={submit} onCancel={onCancel} />
    </div>
  );
}
