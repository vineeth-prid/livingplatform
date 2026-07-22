import { useState } from 'react';
import { Gauge, Plus, Trash2 } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { useAuth } from '@living/hooks';
import { Button, EmptyState, Input, toast, useConfirm } from '@living/ui';
import type { AMCSLARule } from '@living/types';

import { PriorityPill } from '../operations';
import { useContractMutations } from './queries';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const mins = (n?: number | null) => (n == null ? '—' : n >= 60 ? `${(n / 60).toFixed(n % 60 ? 1 : 0)}h` : `${n}m`);

/** Per-priority SLA targets — response / resolution / escalation. Managers add/remove. */
export function ContractSla({ contractId, rules, onChanged }: { contractId: string; rules: AMCSLARule[]; onChanged: () => void }) {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const { addSla, removeSla } = useContractMutations(contractId);
  const canManage = hasPermission('amc:sla:manage');

  const [priority, setPriority] = useState('MEDIUM');
  const [response, setResponse] = useState('');
  const [resolution, setResolution] = useState('');
  const [escalation, setEscalation] = useState('');

  const used = new Set(rules.map((r) => r.priority));
  const available = PRIORITIES.filter((p) => !used.has(p));
  const ordered = [...rules].sort((a, b) => PRIORITIES.indexOf(a.priority as never) - PRIORITIES.indexOf(b.priority as never));

  async function add() {
    if (!response || !resolution) return;
    try {
      await addSla.mutateAsync({
        priority, responseTimeMinutes: Number(response), resolutionTimeMinutes: Number(resolution),
        escalationAfterMinutes: escalation ? Number(escalation) : undefined,
      });
      setResponse(''); setResolution(''); setEscalation(''); setPriority(available[1] ?? available[0] ?? 'MEDIUM');
      onChanged();
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add SLA rule');
    }
  }
  async function remove(id: string) {
    if (!(await confirm({ title: 'Remove SLA rule?', tone: 'danger', confirmLabel: 'Remove' }))) return;
    try { await removeSla.mutateAsync(id); onChanged(); }
    catch (err) { toast.error(err instanceof LivingApiError ? err.message : 'Could not remove'); }
  }

  return (
    <div className="flex flex-col gap-4">
      {ordered.length === 0 ? (
        <EmptyState icon={Gauge} title="No SLA rules" description="Define response and resolution targets per priority." />
      ) : (
        <div className="overflow-hidden rounded-card border border-border-subtle">
          <table className="w-full text-sm">
            <thead className="bg-sunken/60 text-2xs uppercase tracking-wider text-subtle">
              <tr><th className="px-3.5 py-2 text-left font-semibold">Priority</th><th className="px-3.5 py-2 text-left font-semibold">Response</th><th className="px-3.5 py-2 text-left font-semibold">Resolution</th><th className="px-3.5 py-2 text-left font-semibold">Escalation</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {ordered.map((r) => (
                <tr key={r.id}>
                  <td className="px-3.5 py-2.5"><PriorityPill priority={r.priority} /></td>
                  <td className="px-3.5 py-2.5 text-body">{mins(r.responseTimeMinutes)}</td>
                  <td className="px-3.5 py-2.5 text-body">{mins(r.resolutionTimeMinutes)}</td>
                  <td className="px-3.5 py-2.5 text-muted">{mins(r.escalationAfterMinutes)}</td>
                  <td className="px-3.5 py-2.5 text-right">
                    {canManage && <button onClick={() => remove(r.id)} aria-label="Remove SLA rule" className="rounded-md p-1.5 text-subtle transition-colors hover:bg-sunken hover:text-danger-fg"><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && available.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-card border border-border-subtle bg-sunken/40 p-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-strong">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-11 rounded-control border border-border bg-raised px-3 text-base text-strong outline-none focus-visible:shadow-ring">
              {available.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <div className="w-28"><Input label="Response (min)" type="number" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="60" /></div>
          <div className="w-28"><Input label="Resolution (min)" type="number" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="240" /></div>
          <div className="w-28"><Input label="Escalation (min)" type="number" value={escalation} onChange={(e) => setEscalation(e.target.value)} placeholder="120" /></div>
          <Button onClick={add} loading={addSla.isPending} disabled={!response || !resolution}><Plus className="h-4 w-4" /> Add rule</Button>
        </div>
      )}
    </div>
  );
}
