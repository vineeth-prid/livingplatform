import { useEffect, useMemo, useState } from 'react';
import { Input } from '@living/ui';

import {
  CheckboxField, FormFooter, FormGrid, FormSection, FullWidth, SelectField, TextAreaField,
} from '../shared/form-kit';
import { FREQUENCY } from './config';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
const optionsOf = (values: readonly string[]) => values.map((v) => ({ value: v, label: humanize(v) }));

export interface PlanValues {
  name: string; description: string; assetId: string;
  frequencyType: string; frequencyInterval: string; cronExpression: string;
  startDate: string; endDate: string;
  priority: string; estimatedDurationMinutes: string; requiresVerification: string;
}

const KEYS: (keyof PlanValues)[] = [
  'name', 'description', 'assetId', 'frequencyType', 'frequencyInterval', 'cronExpression',
  'startDate', 'endDate', 'priority', 'estimatedDurationMinutes', 'requiresVerification',
];
const seed = (initial: Partial<PlanValues>): PlanValues => {
  const v = {} as PlanValues;
  for (const k of KEYS) v[k] = initial[k] ?? '';
  return v;
};

export function validatePlan(v: PlanValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = 'Required';
  if (!v.assetId) e.assetId = 'Required';
  if (!v.frequencyType) e.frequencyType = 'Required';
  if (!v.startDate) e.startDate = 'Required';
  if (v.frequencyType === 'CUSTOM' && !v.cronExpression.trim()) e.cronExpression = 'A cron expression is required';
  if (v.startDate && v.endDate && Date.parse(v.endDate) <= Date.parse(v.startDate)) e.endDate = 'Must be after start';
  return e;
}

export function toPlanBody(v: PlanValues): Record<string, unknown> {
  const iso = (s: string) => (s ? new Date(s).toISOString() : undefined);
  return {
    name: v.name.trim(),
    description: v.description.trim() || undefined,
    assetId: v.assetId,
    frequencyType: v.frequencyType,
    frequencyInterval: v.frequencyInterval ? Number(v.frequencyInterval) : undefined,
    cronExpression: v.frequencyType === 'CUSTOM' ? v.cronExpression.trim() || undefined : undefined,
    startDate: iso(v.startDate),
    endDate: iso(v.endDate),
    priority: v.priority || undefined,
    estimatedDurationMinutes: v.estimatedDurationMinutes ? Number(v.estimatedDurationMinutes) : undefined,
    requiresVerification: v.requiresVerification === 'true' ? true : undefined,
  };
}

const DRAFT_KEY = 'living.plan-draft';

export function PlanForm({
  mode, assets, initial, submitting, onSubmit, onCancel,
}: {
  mode: 'create' | 'edit';
  assets: { value: string; label: string }[];
  initial?: Partial<PlanValues>;
  submitting?: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<PlanValues>(() => {
    if (mode === 'create' && typeof window !== 'undefined') {
      const d = window.localStorage.getItem(DRAFT_KEY);
      if (d) { try { return { ...seed({}), ...JSON.parse(d) }; } catch { /* ignore */ } }
    }
    return seed(initial ?? {});
  });
  const [touched, setTouched] = useState(false);
  const errors = useMemo(() => validatePlan(values), [values]);
  const set = (k: keyof PlanValues, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
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
    onSubmit(toPlanBody(values));
  };

  return (
    <div className="flex flex-col gap-5">
      <FormSection title="General" description="What this plan is.">
        <FormGrid>
          <FullWidth><Input label="Plan name" value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Quarterly DG servicing" error={err('name')} /></FullWidth>
          <FullWidth><TextAreaField label="Description" value={values.description} onChange={(v) => set('description', v)} /></FullWidth>
        </FormGrid>
      </FormSection>

      <FormSection title="Asset" description="The asset this plan maintains.">
        <FormGrid>
          <FullWidth><SelectField label="Asset" required value={values.assetId} onChange={(v) => set('assetId', v)} options={assets} placeholder="Select an asset" error={err('assetId')} /></FullWidth>
        </FormGrid>
      </FormSection>

      <FormSection title="Schedule" description="How often maintenance is due.">
        <FormGrid>
          <SelectField label="Frequency" required value={values.frequencyType} onChange={(v) => set('frequencyType', v)} options={optionsOf(FREQUENCY)} placeholder="Select frequency" error={err('frequencyType')} />
          {values.frequencyType === 'CUSTOM' ? (
            <Input label="Cron expression" value={values.cronExpression} onChange={(e) => set('cronExpression', e.target.value)} placeholder="0 6 1 * *" error={err('cronExpression')} />
          ) : (
            <Input label="Interval" type="number" value={values.frequencyInterval} onChange={(e) => set('frequencyInterval', e.target.value)} placeholder="1" />
          )}
          <Input label="Start date" type="date" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} error={err('startDate')} />
          <Input label="End date (optional)" type="date" value={values.endDate} onChange={(e) => set('endDate', e.target.value)} error={err('endDate')} />
        </FormGrid>
      </FormSection>

      <FormSection title="Execution" description="Priority, effort and verification.">
        <FormGrid>
          <SelectField label="Priority" value={values.priority} onChange={(v) => set('priority', v)} options={optionsOf(PRIORITIES)} placeholder="Medium" />
          <Input label="Estimated duration (min)" type="number" value={values.estimatedDurationMinutes} onChange={(e) => set('estimatedDurationMinutes', e.target.value)} placeholder="120" />
          <FullWidth>
            <CheckboxField label="Requires verification" hint="Generated work orders must be verified before closing."
              checked={values.requiresVerification === 'true'} onChange={(c) => set('requiresVerification', c ? 'true' : '')} />
          </FullWidth>
        </FormGrid>
      </FormSection>

      {mode === 'create' && (
        <div className="rounded-card border border-dashed border-border p-4 text-sm text-subtle">
          Checklist items can be added from the plan’s page once it’s created.
        </div>
      )}

      <FormFooter submitLabel={mode === 'create' ? 'Create plan' : 'Save changes'} submitting={submitting}
        disabled={touched && Object.keys(errors).length > 0} onSubmit={submit} onCancel={onCancel} />
    </div>
  );
}
