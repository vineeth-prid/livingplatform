import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Package } from 'lucide-react';
import type { PackageEntitlement, PackagePurchase } from '@living/living-sdk';
import { Badge, Button, Card, EmptyState, Skeleton, toast } from '@living/ui';

import { useResidentCommunity } from '../community';
import { living } from '../lib/living';
import { ScreenHeader } from '../shell';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  EXPIRED: 'neutral',
  COMPLETED: 'info',
  CANCELLED: 'neutral',
};

/**
 * The resident's bought packages and what is left in each.
 *
 * Redeeming books an ordinary Service Request — the same one the Services
 * screen creates — so a redeemed visit appears in "My requests" and follows the
 * normal assignment and notification flow. There is no separate package booking
 * to track.
 */
export function MyPackagesScreen() {
  const { communityId } = useResidentCommunity();

  const purchases = useQuery({
    queryKey: ['package-purchases', communityId],
    queryFn: () =>
      living.packages.purchases(communityId!, { limit: 25, sortBy: 'createdAt', sortDir: 'desc' }),
    enabled: !!communityId,
  });

  const rows = purchases.data?.items ?? [];

  return (
    <div>
      <ScreenHeader title="My packages" subtitle="Prepaid visits" />
      <div className="px-4">
        {purchases.isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No packages yet"
            description="Buy a package from Services to prepay for a set of visits."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((purchase) => (
              <PurchaseCard key={purchase.id} purchase={purchase} communityId={communityId!} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PurchaseCard({
  purchase,
  communityId,
}: {
  purchase: PackagePurchase;
  communityId: string;
}) {
  const qc = useQueryClient();
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const redeem = useMutation({
    mutationFn: (serviceId: string) =>
      living.packages.redeem(communityId, purchase.id, { serviceId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['package-purchases'] });
      void qc.invalidateQueries({ queryKey: ['my'] });
      toast.success('Booked — you can follow it in My requests');
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setRedeeming(null),
  });

  const spendable = purchase.status === 'ACTIVE';

  return (
    <Card variant="elevated">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-h4 leading-tight tracking-tight text-strong">
            {purchase.packageName}
          </p>
          {purchase.validUntil && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle">
              <CalendarClock className="h-3.5 w-3.5" />
              {purchase.daysRemaining !== null && purchase.daysRemaining > 0
                ? `${purchase.daysRemaining} days left`
                : `Expired ${new Date(purchase.validUntil).toLocaleDateString()}`}
            </p>
          )}
        </div>
        <Badge tone={STATUS_TONE[purchase.status] ?? 'neutral'} size="sm" dot>
          {purchase.status.toLowerCase()}
        </Badge>
      </div>

      {purchase.status === 'PENDING' && (
        <p className="mb-3 rounded-control bg-warning-bg px-3 py-2 text-xs text-warning-fg">
          Awaiting payment — your visits unlock once the payment settles.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {purchase.entitlements.map((entitlement) => (
          <EntitlementRow
            key={entitlement.serviceId}
            entitlement={entitlement}
            spendable={spendable}
            busy={redeeming === entitlement.serviceId}
            disabled={redeem.isPending}
            onRedeem={() => {
              setRedeeming(entitlement.serviceId);
              redeem.mutate(entitlement.serviceId);
            }}
          />
        ))}
      </ul>
    </Card>
  );
}

function EntitlementRow({
  entitlement,
  spendable,
  busy,
  disabled,
  onRedeem,
}: {
  entitlement: PackageEntitlement;
  spendable: boolean;
  busy: boolean;
  disabled: boolean;
  onRedeem: () => void;
}) {
  const exhausted = entitlement.remaining <= 0;
  return (
    <li className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-body">{entitlement.serviceName}</p>
        <p className="text-xs text-subtle" data-numeric>
          {entitlement.remaining} of {entitlement.total} left
        </p>
      </div>
      {spendable && !exhausted ? (
        <Button size="sm" variant="secondary" loading={busy} disabled={disabled} onClick={onRedeem}>
          Book
        </Button>
      ) : (
        <span className="text-xs text-subtle">{exhausted ? 'All used' : '—'}</span>
      )}
    </li>
  );
}
