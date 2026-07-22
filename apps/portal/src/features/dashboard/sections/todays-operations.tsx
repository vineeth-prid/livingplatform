import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, LifeBuoy, Timer, Wrench,
} from 'lucide-react';
import { usePermissions } from '@living/hooks';
import { Skeleton } from '@living/ui';

import { KpiCard, type KpiCardProps } from '../components/kpi-card';
import { Section } from '../components/section';
import type { DashboardKpis } from '../derive';

/** Section 2 — operational KPIs. Each tile animates its counter, shows an icon,
 *  carries urgency tone, and navigates to its module on click. Permission-aware. */
export function TodaysOperations({ kpis, loading }: { kpis: DashboardKpis; loading: boolean }) {
  const { has } = usePermissions();

  const tiles: (KpiCardProps & { perm: string })[] = [
    { perm: 'ticket:view', label: 'Open tickets', value: kpis.openTickets, icon: LifeBuoy, href: '/tickets', tone: 'default' },
    { perm: 'ticket:view', label: 'Critical tickets', value: kpis.criticalTickets, icon: AlertTriangle, href: '/tickets', tone: 'danger' },
    { perm: 'service:view', label: 'Open service requests', value: kpis.openServiceRequests, icon: Wrench, href: '/service-requests', tone: 'default' },
    { perm: 'workorder:view', label: 'Pending work orders', value: kpis.pendingWorkOrders, icon: ClipboardCheck, href: '/work-orders', tone: 'default' },
    { perm: 'workorder:verify', label: 'Awaiting verification', value: kpis.pendingVerification, icon: CheckCircle2, href: '/work-orders', tone: 'warning' },
    { perm: 'workorder:view', label: 'Overdue work orders', value: kpis.overdueWorkOrders, icon: Timer, href: '/work-orders', tone: 'danger' },
    { perm: 'service:view', label: 'Scheduled today', value: kpis.scheduledToday, icon: CalendarClock, href: '/service-requests', tone: 'default' },
  ];
  const visible = tiles.filter((t) => has(t.perm));
  if (visible.length === 0) return null;

  return (
    <Section title="Today’s operations">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-card" />
            ))
          : visible.map((t) => (
              <KpiCard key={t.label} label={t.label} value={t.value} icon={t.icon} href={t.href} tone={t.tone} />
            ))}
      </div>
    </Section>
  );
}
