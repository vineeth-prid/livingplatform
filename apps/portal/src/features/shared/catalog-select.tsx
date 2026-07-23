import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LivingApiError, type CatalogKind } from '@living/living-sdk';
import { Button, Input, toast } from '@living/ui';
import { Plus, Trash2, X } from 'lucide-react';

import { living } from '../../lib/living';

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

function useCatalog(kind: CatalogKind) {
  return useQuery({
    queryKey: ['catalog', kind],
    queryFn: () => living.catalog.list(kind),
  });
}

/** Small popover to add/remove tenant options for a catalog kind. */
function ManagePanel({ kind, onClose }: { kind: CatalogKind; onClose: () => void }) {
  const qc = useQueryClient();
  const { data = [] } = useCatalog(kind);
  const [name, setName] = useState('');

  const add = useMutation({
    mutationFn: () => living.catalog.create(kind, name.trim()),
    onSuccess: () => { setName(''); void qc.invalidateQueries({ queryKey: ['catalog', kind] }); },
    onError: (e) => toast.error(e instanceof LivingApiError ? e.message : 'Could not add'),
  });
  const del = useMutation({
    mutationFn: (id: string) => living.catalog.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['catalog', kind] }),
    onError: (e) => toast.error(e instanceof LivingApiError ? e.message : 'Could not remove'),
  });

  return (
    <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-card border border-border bg-raised p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-strong">Manage options</span>
        <button type="button" onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted" /></button>
      </div>
      <div className="mb-2 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New option" className="flex-1"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (name.trim()) add.mutate(); } }} />
        <Button size="sm" onClick={() => name.trim() && add.mutate()} loading={add.isPending}><Plus className="h-4 w-4" /></Button>
      </div>
      <ul className="max-h-52 overflow-y-auto">
        {data.map((o) => (
          <li key={o.name} className="flex items-center justify-between py-1 text-sm text-strong">
            <span>{humanize(o.name)}</span>
            {o.id
              ? <button type="button" onClick={() => del.mutate(o.id!)} aria-label={`Remove ${o.name}`}><Trash2 className="h-3.5 w-3.5 text-muted hover:text-danger-fg" /></button>
              : <span className="text-2xs uppercase text-subtle">default</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single-select bound to a tenant catalog, with an inline manage panel. */
export function CatalogSelect({
  kind, label, value, onChange, required, error,
}: {
  kind: CatalogKind; label: string; value: string; onChange: (v: string) => void;
  required?: boolean; error?: string;
}) {
  const { data = [] } = useCatalog(kind);
  const [managing, setManaging] = useState(false);
  return (
    <div className="relative">
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-sm font-medium text-strong">
          <span>{label}{required && <span className="text-danger-fg"> *</span>}</span>
          <button type="button" onClick={() => setManaging((m) => !m)} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
            <Plus className="h-3 w-3" /> Manage
          </button>
        </span>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className={`h-11 rounded-control border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring ${error ? 'border-danger-fg' : 'border-border'}`}>
          <option value="">Select…</option>
          {data.map((o) => <option key={o.name} value={o.name}>{humanize(o.name)}</option>)}
        </select>
        {error && <span className="text-sm text-danger-fg">{error}</span>}
      </label>
      {managing && <ManagePanel kind={kind} onClose={() => setManaging(false)} />}
    </div>
  );
}

/** Multi-select (checkbox list) bound to a tenant catalog, with manage panel. */
export function CatalogMultiSelect({
  kind, label, values, onChange,
}: {
  kind: CatalogKind; label: string; values: string[]; onChange: (v: string[]) => void;
}) {
  const { data = [] } = useCatalog(kind);
  const [managing, setManaging] = useState(false);
  const toggle = (name: string) =>
    onChange(values.includes(name) ? values.filter((v) => v !== name) : [...values, name]);
  return (
    <div className="relative">
      <span className="flex items-center justify-between text-sm font-medium text-strong">
        <span>{label}</span>
        <button type="button" onClick={() => setManaging((m) => !m)} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
          <Plus className="h-3 w-3" /> Manage
        </button>
      </span>
      <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-control border border-border bg-raised p-2">
        {data.map((o) => {
          const on = values.includes(o.name);
          return (
            <button key={o.name} type="button" onClick={() => toggle(o.name)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${on ? 'bg-brand text-white' : 'bg-sunken text-muted hover:text-strong'}`}>
              {humanize(o.name)}
            </button>
          );
        })}
        {data.length === 0 && <span className="text-xs text-subtle">No options — add some.</span>}
      </div>
      {managing && <ManagePanel kind={kind} onClose={() => setManaging(false)} />}
    </div>
  );
}
