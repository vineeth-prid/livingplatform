import { useMemo, useState } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { Button, Input, toast } from '@living/ui';
import { Plus, X } from 'lucide-react';

export interface EntityOption { value: string; label: string }

/**
 * A single-select with a searchable filter and an inline "＋ New" creator — for
 * lists that grow (ticket categories, services, asset categories). The parent
 * owns fetching/creating; this only handles the picking + create UX.
 */
export function EntitySelect({
  label, value, onChange, options, placeholder, required, error, loading,
  onCreate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: EntityOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  loading?: boolean;
  /** Create a new option; return its id to auto-select it. */
  onCreate?: (name: string) => Promise<string>;
}) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const create = async () => {
    if (!onCreate || !newName.trim()) return;
    setBusy(true);
    try {
      const id = await onCreate(newName.trim());
      onChange(id);
      setNewName('');
      setCreating(false);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-sm font-medium text-strong">
        <span>{label}{required && <span className="text-danger-fg"> *</span>}</span>
        {onCreate && (
          <button type="button" onClick={() => setCreating((c) => !c)} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
            {creating ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {creating ? 'Cancel' : 'New'}
          </button>
        )}
      </span>

      {creating ? (
        <div className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New name" className="flex-1" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void create(); } }} />
          <Button size="sm" onClick={create} loading={busy} disabled={!newName.trim()}>Add</Button>
        </div>
      ) : (
        <>
          {options.length > 8 && (
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="mb-1" />
          )}
          <select value={value} onChange={(e) => onChange(e.target.value)}
            className={`h-11 rounded-control border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring ${error ? 'border-danger-fg' : 'border-border'}`}>
            <option value="">{loading ? 'Loading…' : placeholder ?? 'Select…'}</option>
            {filtered.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </>
      )}
      {error && <span className="text-sm text-danger-fg">{error}</span>}
    </div>
  );
}

/** name → KEY_SLUG for entities that require a `key` alongside `name`. */
export function toKey(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'ITEM';
}
