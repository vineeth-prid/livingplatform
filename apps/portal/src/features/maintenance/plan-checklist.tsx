import { useState } from 'react';
import { CheckSquare, Plus, Trash2 } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Badge, Button, EmptyState, Input, toast, useConfirm } from '@living/ui';
import type { MaintenanceChecklistTemplate } from '@living/types';

import { usePlanMutations } from './queries';

/** The plan's checklist template — read-only items with an add/remove control
 *  for managers (checklist EXECUTION is a future sprint). */
export function PlanChecklist({ planId, items, onChanged }: {
  planId: string; items: MaintenanceChecklistTemplate[]; onChanged: () => void;
}) {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const { addChecklistItem, removeChecklistItem } = usePlanMutations(planId);
  const canManage = hasPermission('maintenance:checklist:manage');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  async function add() {
    const t = title.trim();
    if (!t) return;
    try {
      await addChecklistItem.mutateAsync({ title: t, instructions: instructions.trim() || undefined, isMandatory: mandatory, sortOrder: items.length });
      setTitle(''); setInstructions(''); setMandatory(true);
      onChanged();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add item');
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: 'Remove checklist item?', tone: 'danger', confirmLabel: 'Remove' }))) return;
    try { await removeChecklistItem.mutateAsync(id); onChanged(); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not remove'); }
  }

  return (
    <div className="flex flex-col gap-4">
      {sorted.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No checklist items" description="Add the steps a technician should follow." />
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-card border border-border-subtle">
          {sorted.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-3.5 py-3">
              <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-strong">{item.title}</p>
                  {item.isMandatory ? <Badge tone="warning" size="sm">Mandatory</Badge> : <Badge tone="neutral" size="sm">Optional</Badge>}
                </div>
                {item.instructions && <p className="mt-0.5 text-sm text-muted">{item.instructions}</p>}
              </div>
              {canManage && (
                <button onClick={() => remove(item.id)} aria-label="Remove item" className="rounded-md p-1.5 text-subtle transition-colors hover:bg-sunken hover:text-danger-fg">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-col gap-3 rounded-card border border-border-subtle bg-sunken/40 p-3">
          <Input label="New item" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Check oil level and top up" />
          <Input label="Instructions (optional)" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} className="h-4 w-4 accent-[var(--brand-primary)]" /> Mandatory
            </label>
            <Button size="sm" onClick={add} loading={addChecklistItem.isPending} disabled={!title.trim()}><Plus className="h-4 w-4" /> Add item</Button>
          </div>
        </div>
      )}
    </div>
  );
}
