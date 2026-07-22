import { formatNumber } from '@living/utils';
import { Card, Skeleton } from '@living/ui';

import { Section } from '../components/section';
import type { HealthIndicators } from '../derive';

/** A calm horizontal meter (no chart library) — clearer than a pie for a rate. */
function Meter({ label, value, hint, tone = 'brand' }: {
  label: string; value: number; hint?: string; tone?: 'brand' | 'success' | 'warning';
}) {
  const pct = Math.round(value * 100);
  const barColor =
    tone === 'success' ? 'var(--success-solid)' : tone === 'warning' ? 'var(--warning-solid)' : 'var(--brand-primary)';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-body">{label}</span>
        <span className="font-mono text-sm font-medium text-strong" data-numeric>
          {pct}%{hint ? <span className="ml-1 text-subtle">{hint}</span> : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-sunken">
        <div
          className="h-full rounded-pill transition-[width] duration-slow ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

/** Section 5 — simple operational health indicators (no heavy analytics). */
export function CommunityHealth({ health, loading }: { health: HealthIndicators; loading: boolean }) {
  if (loading) {
    return (
      <Section title="Community health">
        <Card variant="elevated" className="flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
        </Card>
      </Section>
    );
  }

  return (
    <Section title="Community health">
      <Card variant="elevated" className="flex flex-col gap-5">
        <Meter
          label="Tickets closed"
          value={health.ticketClosureRate}
          hint={`${formatNumber(health.closedTickets)}/${formatNumber(health.openTickets + health.closedTickets)}`}
          tone="success"
        />
        <Meter label="Service completion" value={health.serviceCompletionRate} tone="brand" />
        {health.occupancyRate !== null && (
          <Meter label="Occupancy" value={health.occupancyRate} tone="brand" />
        )}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <span className="text-sm text-body">Pending verification</span>
          <span className="font-mono text-sm font-medium text-strong" data-numeric>
            {formatNumber(health.pendingVerification)}
          </span>
        </div>
      </Card>
    </Section>
  );
}
