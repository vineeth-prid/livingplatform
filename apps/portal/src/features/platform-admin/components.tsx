import { type ReactNode } from 'react';
import { Badge, Card } from '@living/ui';
import { cn } from '@living/utils';
import { CheckCircle2, XCircle } from 'lucide-react';

/** Quiet eyebrow section heading, matching the operational dashboard. */
export function PlatformSection({
  title, description, action, children,
}: {
  title: string; description?: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xs font-semibold uppercase tracking-wider text-subtle">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Marks a panel as showing placeholder data (no backend endpoint yet). */
export function MockBadge() {
  return <Badge tone="warning" size="sm">Placeholder</Badge>;
}

/** Grid of KPI cards — responsive columns. */
export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  const map = { 3: 'md:grid-cols-3', 4: 'md:grid-cols-4', 5: 'md:grid-cols-5' } as const;
  return <div className={cn('grid grid-cols-2 gap-3', map[cols])}>{children}</div>;
}

/** Health/infra status card — green when up, red when down. */
export function StatusCard({ name, ok, detail }: { name: string; ok: boolean; detail?: string }) {
  return (
    <Card variant="elevated" className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-strong">{name}</p>
        <p className={cn('text-xs', ok ? 'text-success-fg' : 'text-danger-fg')}>{detail ?? (ok ? 'Operational' : 'Unavailable')}</p>
      </div>
      {ok
        ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success-fg" />
        : <XCircle className="h-5 w-5 shrink-0 text-danger-fg" />}
    </Card>
  );
}

/** Small labelled value row (System info tables). */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2.5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-strong">{value}</span>
    </div>
  );
}

/** Placeholder tile for a future feature (Revenue/MRR/ARR/Churn/etc.). */
export function FutureTile({ label }: { label: string }) {
  return (
    <Card variant="elevated" className="flex flex-col gap-1.5 border-dashed opacity-70">
      <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <span className="font-display text-h3 text-muted">—</span>
      <span className="text-xs text-subtle">Coming with billing</span>
    </Card>
  );
}
