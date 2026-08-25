import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { cn } from '@living/utils';
import { EmptyState } from '@living/ui';

import { ScreenHeader } from '../shell';
import { GateArrivalsScreen } from './gate-deliveries';

/**
 * The security desk. One register — the gate engine — shown through two tabs.
 *
 * Both tabs read the same GateEntry records, filtered by entry type. That is
 * the whole fix for "a visitor shows up as a delivery": the arrivals list used
 * to render every entry type through delivery-shaped copy and offer "Handed
 * over" on a visit, while the Visitors tab read the retired `visitors` table
 * that nothing writes to any more — so a resident's invitation appeared in the
 * wrong tab, wrongly labelled, and was missing from the right one.
 */
export function GateScreen() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'deliveries' | 'visitors'>('deliveries');

  if (!hasPermission('gate:entry:view')) {
    return (
      <div>
        <ScreenHeader title="Gate" subtitle="Security" />
        <div className="px-4">
          <EmptyState
            icon={ShieldCheck}
            title="No gate access"
            description={
              'Gate duty is granted by the Security role. Ask your facility manager to set your ' +
              'staff role to Security, then sign out and back in.'
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Gate" subtitle="Security" />
      <div className="flex gap-1.5 px-4">
        {([['deliveries', 'Deliveries'], ['visitors', 'Visitors']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              'flex-1 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
              tab === v ? 'bg-brand text-brand-fg' : 'bg-sunken text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <GateArrivalsScreen entryType={tab === 'deliveries' ? 'DELIVERY' : 'VISITOR'} />
    </div>
  );
}
