import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Package, Sparkles, Wrench } from 'lucide-react';
import type { ServicePackage } from '@living/living-sdk';
import type { Service } from '@living/types';
import { useCommunityFeatures } from '@living/hooks';
import { Badge, Button, Card, Dialog, DialogContent, EmptyState, Skeleton, toast } from '@living/ui';

import { useResidentCommunity } from '../community';
import { CreateRequestSheet } from '../create-request-sheet';
import { living } from '../lib/living';
import { openCheckout } from '../payments/razorpay';
import { Section } from '../components';
import { ScreenHeader } from '../shell';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/**
 * Browse and book. Packages come FIRST — a bundle is the better deal and the
 * higher-value action — then individual services. Inactive services never reach
 * here: the API only returns active ones.
 */
export function ServicesScreen() {
  const { communityId } = useResidentCommunity();
  const features = useCommunityFeatures(communityId);
  const [picked, setPicked] = useState<Service | null>(null);
  const [pickedPackage, setPickedPackage] = useState<ServicePackage | null>(null);

  const services = useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => living.serviceRequest.listServices({ activeOnly: true }),
  });

  const packages = useQuery({
    queryKey: ['packages', 'available', communityId],
    queryFn: () => living.packages.available(communityId!),
    enabled: !!communityId && features.servicePackages,
  });

  const packageRows = packages.data ?? [];
  const serviceRows = services.data ?? [];

  return (
    <div>
      <ScreenHeader title="Services" subtitle="Book help" />
      <div className="px-4">
        {features.servicePackages && (packages.isLoading || packageRows.length > 0) && (
          <Section title="Packages">
            {packages.isLoading ? (
              <Skeleton className="h-32 rounded-card" />
            ) : (
              <div className="flex flex-col gap-3">
                {packageRows.map((pkg) => (
                  <PackageCard key={pkg.id} pkg={pkg} onOpen={() => setPickedPackage(pkg)} />
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title={packageRows.length > 0 ? 'Individual services' : 'Services'}>
          {services.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-card" />
              ))}
            </div>
          ) : serviceRows.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No services yet"
              description="Your community hasn’t published services."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {serviceRows.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPicked(s)}
                  className="rounded-card text-left focus-visible:outline-none focus-visible:shadow-ring"
                >
                  <Card variant="elevated" className="flex h-full flex-col gap-2 transition-shadow active:shadow-md">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-brand"
                      style={
                        s.color
                          ? {
                              backgroundColor: `color-mix(in oklab, ${s.color} 16%, transparent)`,
                              color: s.color,
                            }
                          : undefined
                      }
                    >
                      <Wrench className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-strong">{s.name}</p>
                      {s.basePrice != null ? (
                        <p className="text-xs text-muted">{inr(Number(s.basePrice))}</p>
                      ) : (
                        s.estimatedDurationMinutes != null && (
                          <p className="text-xs text-subtle">~{s.estimatedDurationMinutes} min</p>
                        )
                      )}
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      <CreateRequestSheet
        open={!!picked}
        onOpenChange={(o) => {
          if (!o) setPicked(null);
        }}
        mode="service"
        serviceId={picked?.id}
        serviceName={picked?.name}
      />

      {pickedPackage && (
        <PackageDetailDialog pkg={pickedPackage} onClose={() => setPickedPackage(null)} />
      )}
    </div>
  );
}

function PackageCard({ pkg, onOpen }: { pkg: ServicePackage; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-card text-left focus-visible:outline-none focus-visible:shadow-ring"
    >
      <Card variant="elevated" className="transition-shadow active:shadow-md">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-tint text-brand">
            <Package className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-h4 leading-tight tracking-tight text-strong">{pkg.name}</p>
            <p className="mt-0.5 truncate text-xs text-subtle">
              {pkg.items.map((i) => `${i.quantity}× ${i.serviceName}`).join(' · ')}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <span className="font-display text-h3 leading-none tracking-tight text-strong" data-numeric>
              {inr(pkg.price)}
            </span>
            {pkg.listPrice !== null && pkg.savings !== null && pkg.savings > 0 && (
              <span className="ml-2 text-sm text-subtle line-through" data-numeric>
                {inr(pkg.listPrice)}
              </span>
            )}
          </div>
          {pkg.savings !== null && pkg.savings > 0 && (
            <Badge tone="success" size="sm">
              Save {inr(pkg.savings)}
            </Badge>
          )}
        </div>
      </Card>
    </button>
  );
}

/**
 * Package detail + purchase. Buying reuses the SAME checkout the maintenance
 * and service rails use — the server prices the package, mints the order and
 * verifies the signature; nothing about the price is decided here.
 */
function PackageDetailDialog({ pkg, onClose }: { pkg: ServicePackage; onClose: () => void }) {
  const { communityId, community } = useResidentCommunity();
  const qc = useQueryClient();

  const buy = useMutation({
    mutationFn: async () => {
      const purchase = await living.packages.purchase(communityId!, { packageId: pkg.id });
      const session = await living.payments.checkout(communityId!, {
        purpose: 'SERVICE',
        packagePurchaseId: purchase.id,
      });
      const result = await openCheckout(session, { communityName: community?.name });
      if (result.status === 'dismissed') return { settled: false as const };
      if (result.status === 'failed') throw new Error(result.reason ?? 'Payment failed');
      await living.payments.verify(communityId!, {
        razorpayOrderId: result.handshake!.razorpay_order_id,
        razorpayPaymentId: result.handshake!.razorpay_payment_id,
        razorpaySignature: result.handshake!.razorpay_signature,
      });
      return { settled: true as const };
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['packages'] });
      if (result.settled) {
        toast.success('Package purchased — book your visits any time');
        onClose();
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      {/* max-w-md keeps the sheet inside the phone frame the shell renders on
          tablet/desktop — the default 560px dialog overflows it. */}
      <DialogContent open title={pkg.name} description={pkg.description ?? undefined} className="max-w-md">
        <div className="mb-4 flex items-baseline gap-2">
          <span className="font-display text-h1 leading-none tracking-tight text-strong" data-numeric>
            {inr(pkg.price)}
          </span>
          {pkg.listPrice !== null && pkg.savings !== null && pkg.savings > 0 && (
            <>
              <span className="text-base text-subtle line-through" data-numeric>
                {inr(pkg.listPrice)}
              </span>
              <Badge tone="success" size="sm">
                {pkg.savingsPercent}% off
              </Badge>
            </>
          )}
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">
          What’s included
        </p>
        <ul className="mb-4 flex flex-col gap-2">
          {pkg.items.map((item) => (
            <li key={item.serviceId} className="flex items-center gap-2.5 text-sm text-body">
              <Check className="h-4 w-4 shrink-0 text-success-fg" />
              <span className="flex-1">
                <strong className="font-medium text-strong">{item.quantity}×</strong>{' '}
                {item.serviceName}
              </span>
              {item.lineTotal !== null && (
                <span className="text-xs text-subtle" data-numeric>
                  {inr(item.lineTotal)}
                </span>
              )}
            </li>
          ))}
        </ul>

        <p className="mb-5 flex items-center gap-2 rounded-control bg-sunken px-3 py-2 text-xs text-muted">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" />
          Book any included visit within {pkg.durationDays} days of purchase.
        </p>

        <Button block size="lg" loading={buy.isPending} onClick={() => buy.mutate()}>
          Buy for {inr(pkg.price)}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
