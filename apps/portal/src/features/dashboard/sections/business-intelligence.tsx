import { useQuery } from '@tanstack/react-query';
import { Award, Package, Receipt, TrendingUp, Users, Wallet } from 'lucide-react';
import { Badge, Card, EmptyState, Skeleton } from '@living/ui';

import { living } from '../../../lib/living';
import { inr } from '../../billing/queries';
import { useCommunity } from '../../community/community-context';
import { Section } from '../components/section';

/**
 * Business intelligence for the community the admin is looking at: adoption,
 * what residents actually book, where the money came from, and which vendors
 * carry the work.
 *
 * Maintenance figures are `null` — not `0` — when the module is off, and the
 * card says "not collected through Living" rather than showing a misleading
 * zero next to a real service figure.
 */
export function BusinessIntelligenceSection() {
  const { communityId } = useCommunity();
  const insights = useQuery({
    queryKey: ['insights', communityId],
    queryFn: () => living.insights.community(communityId!),
    enabled: !!communityId,
    staleTime: 60_000,
  });

  if (insights.isLoading) {
    return (
      <Section title="Business">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      </Section>
    );
  }
  if (!insights.data) return null;
  const d = insights.data;

  return (
    <Section title="Business">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Receipt}
          label="Maintenance collected"
          value={
            d.modules.maintenanceBilling ? inr(d.revenue.maintenanceCollected ?? 0) : 'Not enabled'
          }
          hint={
            d.modules.maintenanceBilling
              ? `${inr(d.revenue.maintenanceOutstanding ?? 0)} outstanding`
              : 'Collected outside Living'
          }
          muted={!d.modules.maintenanceBilling}
        />
        <Metric
          icon={Wallet}
          label="Service collected"
          value={inr(d.revenue.serviceCollected)}
          hint={`${inr(d.revenue.packageRevenue)} from packages`}
        />
        <Metric
          icon={Users}
          label="Residents using services"
          value={`${d.serviceAdoption.residentsUsingServices}/${d.serviceAdoption.totalResidents}`}
          hint={`${d.serviceAdoption.adoptionPercent}% adoption`}
        />
        <Metric
          icon={TrendingUp}
          label="Requests (30 days)"
          value={String(d.serviceAdoption.requestsLast30Days)}
          hint="Service requests raised"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card variant="elevated">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-strong">
            <Award className="h-4 w-4 text-muted" /> Most booked
          </h3>
          {d.mostBookedService ? (
            <div className="mb-3">
              <p className="text-xs uppercase tracking-wider text-subtle">Service</p>
              <p className="text-sm font-medium text-strong">{d.mostBookedService.name}</p>
              <p className="text-xs text-muted">{d.mostBookedService.bookings} bookings</p>
            </div>
          ) : (
            <p className="mb-3 text-sm text-subtle">No services booked yet</p>
          )}
          {d.modules.servicePackages &&
            (d.mostBookedPackage ? (
              <div>
                <p className="text-xs uppercase tracking-wider text-subtle">Package</p>
                <p className="text-sm font-medium text-strong">{d.mostBookedPackage.name}</p>
                <p className="text-xs text-muted">{d.mostBookedPackage.purchases} purchases</p>
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-wider text-subtle">Package</p>
                <p className="text-sm text-subtle">None sold yet</p>
              </div>
            ))}
        </Card>

        <Card variant="elevated" className="lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-strong">
            <Package className="h-4 w-4 text-muted" /> Top vendors
          </h3>
          {d.topVendors.length === 0 ? (
            <EmptyState
              title="No vendor work yet"
              description="Vendors appear here as service requests are completed."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {d.topVendors.map((v) => (
                <li key={v.vendorId} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-body">{v.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="success" size="sm">
                      {v.completed} done
                    </Badge>
                    {v.open > 0 && (
                      <Badge tone="warning" size="sm">
                        {v.open} open
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  muted,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  hint: string;
  muted?: boolean;
}) {
  return (
    <Card variant="elevated" className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-subtle">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <p
        className={`font-display text-h3 leading-none tracking-tight ${muted ? 'text-subtle' : 'text-strong'}`}
        data-numeric
      >
        {value}
      </p>
      <p className="text-xs text-muted">{hint}</p>
    </Card>
  );
}
