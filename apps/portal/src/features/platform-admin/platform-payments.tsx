import { useQuery } from '@tanstack/react-query';
import { CreditCard, Lock, ShieldCheck, Wrench } from 'lucide-react';
import {
  Badge, Card, DataTable, EmptyState, LoadingState, PageContainer, PageHeader, StatCard,
  type Column,
} from '@living/ui';

import { living } from '../../lib/living';

interface CommunityPaymentStatus {
  communityId: string;
  communityName: string;
  maintenanceReady: boolean;
  serviceReady: boolean;
}

/**
 * Platform Admin → Payments.
 *
 * **Status only, by design.** Razorpay accounts belong to each community and
 * are managed by that community's own admin; the platform operator's job is to
 * see who is ready to collect and who still needs onboarding. There is no route
 * that returns a community's credentials to anyone, so there is nothing to show
 * here beyond readiness — and no edit affordance that would imply otherwise.
 */
export function PlatformPaymentsPage() {
  const overview = useQuery({
    queryKey: ['admin', 'payment-config'],
    queryFn: () => living.paymentConfig.platformOverview(),
  });

  if (overview.isLoading) return <LoadingState label="Loading payment configuration…" />;

  const rows = overview.data ?? [];
  const bothReady = rows.filter((r) => r.maintenanceReady && r.serviceReady).length;
  const maintenanceReady = rows.filter((r) => r.maintenanceReady).length;
  const serviceReady = rows.filter((r) => r.serviceReady).length;

  const columns: Column<CommunityPaymentStatus>[] = [
    {
      key: 'community',
      header: 'Community',
      cell: (r) => <span className="font-medium text-strong">{r.communityName}</span>,
    },
    {
      key: 'maintenance',
      header: 'Maintenance rail',
      cell: (r) => <ReadyBadge ready={r.maintenanceReady} />,
    },
    {
      key: 'service',
      header: 'Service rail',
      cell: (r) => <ReadyBadge ready={r.serviceReady} />,
    },
    {
      key: 'summary',
      header: '',
      align: 'right',
      cell: (r) =>
        r.maintenanceReady && r.serviceReady ? (
          <span className="text-xs text-success-fg">Collecting on both rails</span>
        ) : r.maintenanceReady || r.serviceReady ? (
          <span className="text-xs text-warning-fg">One rail still to configure</span>
        ) : (
          <span className="text-xs text-subtle">Not yet configured</span>
        ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Platform admin"
        title="Payments"
        description="Which communities are ready to collect. Credentials are managed by each community and are never visible here."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Communities" value={rows.length} icon={ShieldCheck} />
        <StatCard
          label="Maintenance ready"
          value={`${maintenanceReady}/${rows.length}`}
          icon={CreditCard}
          tone={maintenanceReady === rows.length ? 'success' : 'warning'}
        />
        <StatCard
          label="Service ready"
          value={`${serviceReady}/${rows.length}`}
          icon={Wrench}
          tone={serviceReady === rows.length ? 'success' : 'warning'}
        />
        <StatCard label="Fully onboarded" value={bothReady} icon={ShieldCheck} />
      </div>

      <Card variant="elevated" className="mb-6 flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-sm text-muted">
          Key secrets and webhook secrets are encrypted at rest and are never returned by the API —
          not to a community admin, and not here. A rail reads <strong>ready</strong> when it is
          enabled and has both a key id and a stored secret.
        </p>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No communities yet"
          description="Provision a community to configure its collection rails."
        />
      ) : (
        <Card variant="elevated" className="p-0">
          <DataTable rows={rows} columns={columns} rowKey={(r) => r.communityId} />
        </Card>
      )}
    </PageContainer>
  );
}

function ReadyBadge({ ready }: { ready: boolean }) {
  return ready ? (
    <Badge tone="success" size="sm" dot>
      ready
    </Badge>
  ) : (
    <Badge tone="neutral" size="sm">
      not configured
    </Badge>
  );
}
