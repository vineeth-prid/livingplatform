import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Card, Input } from '@living/ui';
import { cn } from '@living/utils';

import { ASSET_CONDITION, ASSET_CRITICALITY, ASSET_STATUS } from './config';

export interface AssetValues {
  categoryId: string; assetCode: string; name: string; description: string;
  manufacturer: string; model: string; serialNumber: string; barcode: string; qrCode: string;
  blockId: string; floorId: string; locationDescription: string;
  purchaseDate: string; installationDate: string; expectedLifeMonths: string; warrantyExpiry: string;
  status: string; criticality: string; condition: string;
}

export interface AssetFormOptions {
  categories: { value: string; label: string }[];
  blocks: { value: string; label: string }[];
  floors: { value: string; label: string }[];
}

const FIELD_KEYS: (keyof AssetValues)[] = [
  'categoryId', 'assetCode', 'name', 'description', 'manufacturer', 'model',
  'serialNumber', 'barcode', 'qrCode', 'blockId', 'floorId', 'locationDescription',
  'purchaseDate', 'installationDate', 'expectedLifeMonths', 'warrantyExpiry',
  'status', 'criticality', 'condition',
];

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');
const optionsOf = (values: readonly string[]) => values.map((v) => ({ value: v, label: humanize(v) }));

/** Realtime field validation — required core fields + lifecycle date ordering. */
export function validateAsset(v: AssetValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.categoryId) e.categoryId = 'Required';
  if (!v.assetCode?.trim()) e.assetCode = 'Required';
  if (!v.name?.trim()) e.name = 'Required';
  const p = v.purchaseDate ? Date.parse(v.purchaseDate) : NaN;
  const i = v.installationDate ? Date.parse(v.installationDate) : NaN;
  const w = v.warrantyExpiry ? Date.parse(v.warrantyExpiry) : NaN;
  if (!Number.isNaN(p) && !Number.isNaN(i) && i < p) e.installationDate = 'Cannot be before purchase';
  if (!Number.isNaN(p) && !Number.isNaN(w) && w < p) e.warrantyExpiry = 'Cannot be before purchase';
  return e;
}

/** Turn form strings into the API body (ISO dates, numeric life, drop blanks). */
export function toAssetBody(v: AssetValues): Record<string, unknown> {
  const iso = (s?: string) => (s ? new Date(s).toISOString() : undefined);
  const body: Record<string, unknown> = {
    categoryId: v.categoryId,
    assetCode: v.assetCode?.trim(),
    name: v.name?.trim(),
    description: v.description?.trim() || undefined,
    manufacturer: v.manufacturer?.trim() || undefined,
    model: v.model?.trim() || undefined,
    serialNumber: v.serialNumber?.trim() || undefined,
    barcode: v.barcode?.trim() || undefined,
    qrCode: v.qrCode?.trim() || undefined,
    blockId: v.blockId || undefined,
    floorId: v.floorId || undefined,
    locationDescription: v.locationDescription?.trim() || undefined,
    purchaseDate: iso(v.purchaseDate),
    installationDate: iso(v.installationDate),
    warrantyExpiry: iso(v.warrantyExpiry),
    expectedLifeMonths: v.expectedLifeMonths ? Number(v.expectedLifeMonths) : undefined,
    status: v.status || undefined,
    criticality: v.criticality || undefined,
    condition: v.condition || undefined,
  };
  return body;
}

const seed = (initial: Partial<AssetValues>): AssetValues => {
  const v = {} as AssetValues;
  for (const k of FIELD_KEYS) v[k] = initial[k] ?? '';
  return v;
};

interface AssetFormProps {
  mode: 'create' | 'edit';
  options: AssetFormOptions;
  initial?: Partial<AssetValues>;
  submitting?: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}

const DRAFT_KEY = 'living.asset-draft';

/**
 * The multi-section asset form — General / Location / Lifecycle / Warranty /
 * Classification. Controlled, realtime-validated, and draft-safe on create
 * (persisted to localStorage so navigating away never loses work). Photos and
 * documents are managed on the asset's page once it exists.
 */
export function AssetForm({ mode, options, initial, submitting, onSubmit, onCancel }: AssetFormProps) {
  const [values, setValues] = useState<AssetValues>(() => {
    if (mode === 'create' && typeof window !== 'undefined') {
      const draft = window.localStorage.getItem(DRAFT_KEY);
      if (draft) { try { return { ...seed({}), ...JSON.parse(draft) }; } catch { /* ignore */ } }
    }
    return seed(initial ?? {});
  });
  const [touched, setTouched] = useState(false);
  const errors = useMemo(() => validateAsset(values), [values]);

  useEffect(() => {
    if (mode !== 'create') return;
    const t = setTimeout(() => window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values)), 400);
    return () => clearTimeout(t);
  }, [values, mode]);

  const set = (name: keyof AssetValues, value: string) => setValues((v) => ({ ...v, [name]: value }));

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    if (mode === 'create') window.localStorage.removeItem(DRAFT_KEY);
    onSubmit(toAssetBody(values));
  };

  const err = (k: string) => (touched ? errors[k] : undefined);

  return (
    <div className="flex flex-col gap-5">
      <Section title="General" description="Identity and make of the asset.">
        <Grid>
          <SelectField label="Category" required value={values.categoryId} onChange={(v) => set('categoryId', v)}
            options={options.categories} placeholder="Select a category" error={err('categoryId')} />
          <Input label="Asset code" value={values.assetCode} onChange={(e) => set('assetCode', e.target.value)}
            placeholder="DG-001" error={err('assetCode')} />
          <div className="sm:col-span-2">
            <Input label="Name" value={values.name} onChange={(e) => set('name', e.target.value)}
              placeholder="500 kVA Diesel Generator" error={err('name')} />
          </div>
          <div className="sm:col-span-2">
            <TextArea label="Description" value={values.description} onChange={(v) => set('description', v)} />
          </div>
          <Input label="Manufacturer" value={values.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} />
          <Input label="Model" value={values.model} onChange={(e) => set('model', e.target.value)} />
          <Input label="Serial number" value={values.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
          <Input label="Barcode" value={values.barcode} onChange={(e) => set('barcode', e.target.value)} />
          <Input label="QR code" value={values.qrCode} onChange={(e) => set('qrCode', e.target.value)} />
        </Grid>
      </Section>

      <Section title="Location" description="Where the asset physically sits.">
        <Grid>
          <SelectField label="Block" value={values.blockId} onChange={(v) => set('blockId', v)} options={options.blocks} placeholder="No block" />
          <SelectField label="Floor" value={values.floorId} onChange={(v) => set('floorId', v)} options={options.floors} placeholder="No floor" />
          <div className="sm:col-span-2">
            <Input label="Location description" value={values.locationDescription} onChange={(e) => set('locationDescription', e.target.value)}
              placeholder="Basement 1 — DG room" />
          </div>
        </Grid>
      </Section>

      <Section title="Lifecycle" description="Purchase, installation and expected life.">
        <Grid>
          <Input label="Purchase date" type="date" value={values.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} error={err('purchaseDate')} />
          <Input label="Installation date" type="date" value={values.installationDate} onChange={(e) => set('installationDate', e.target.value)} error={err('installationDate')} />
          <Input label="Expected life (months)" type="number" value={values.expectedLifeMonths} onChange={(e) => set('expectedLifeMonths', e.target.value)} placeholder="120" />
        </Grid>
      </Section>

      <Section title="Warranty" description="Coverage window.">
        <Grid>
          <Input label="Warranty expiry" type="date" value={values.warrantyExpiry} onChange={(e) => set('warrantyExpiry', e.target.value)} error={err('warrantyExpiry')} />
        </Grid>
      </Section>

      <Section title="Classification" description="Operational status, criticality and condition.">
        <Grid>
          <SelectField label="Status" value={values.status} onChange={(v) => set('status', v)} options={optionsOf(ASSET_STATUS)} placeholder="Active" />
          <SelectField label="Criticality" value={values.criticality} onChange={(v) => set('criticality', v)} options={optionsOf(ASSET_CRITICALITY)} placeholder="Medium" />
          <SelectField label="Condition" value={values.condition} onChange={(v) => set('condition', v)} options={optionsOf(ASSET_CONDITION)} placeholder="Good" />
        </Grid>
      </Section>

      {mode === 'create' && (
        <div className="rounded-card border border-dashed border-border p-4 text-sm text-subtle">
          Photos and documents can be added from the asset’s page once it’s created.
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 border-t border-border-subtle bg-page/80 px-1 py-3 backdrop-blur">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={submitting} disabled={touched && Object.keys(errors).length > 0} onClick={submit}>
          {mode === 'create' ? 'Create asset' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card variant="elevated">
      <div className="mb-4">
        <h2 className="font-display text-h4 tracking-tight text-strong">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
);

function SelectField({
  label, value, onChange, options, placeholder, required, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; required?: boolean; error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-strong">{label}{required && <span className="text-danger-fg"> *</span>}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={cn('h-11 rounded-control border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring',
          error ? 'border-danger-fg' : 'border-border')}>
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span className="text-sm text-danger-fg">{error}</span>}
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-strong">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        className="rounded-control border border-border bg-raised px-3 py-2 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring" />
    </label>
  );
}
