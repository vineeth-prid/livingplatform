import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaymentPurpose } from '@living/living-sdk';

import { living } from '../../lib/living';

/** One key namespace so a save invalidates every dependent panel at once. */
export const billingKeys = {
  charges: (communityId: string) => ['billing', 'charges', communityId] as const,
  propertyTypes: (communityId: string) => ['billing', 'property-types', communityId] as const,
  invoices: (communityId: string, params: unknown) =>
    ['billing', 'invoices', communityId, params] as const,
  summary: (communityId: string, months: number) =>
    ['billing', 'summary', communityId, months] as const,
  byUnit: (communityId: string, params: unknown) =>
    ['billing', 'by-unit', communityId, params] as const,
  payments: (communityId: string, params: unknown) =>
    ['billing', 'payments', communityId, params] as const,
  paymentConfig: (communityId: string) => ['billing', 'payment-config', communityId] as const,
};

export function useMaintenanceCharges(communityId: string | null) {
  return useQuery({
    queryKey: billingKeys.charges(communityId ?? ''),
    queryFn: () => living.billing.charges(communityId!, { limit: 200, sortBy: 'effectiveFrom', sortDir: 'desc' }),
    enabled: !!communityId,
  });
}

export function usePropertyTypes(communityId: string | null) {
  return useQuery({
    queryKey: billingKeys.propertyTypes(communityId ?? ''),
    queryFn: () => living.billing.propertyTypes(communityId!),
    enabled: !!communityId,
  });
}

export function useCollectionSummary(communityId: string | null, months = 6) {
  return useQuery({
    queryKey: billingKeys.summary(communityId ?? '', months),
    queryFn: () => living.billing.summary(communityId!, months),
    enabled: !!communityId,
  });
}

export function useInvoices(communityId: string | null, params: Record<string, unknown>) {
  return useQuery({
    queryKey: billingKeys.invoices(communityId ?? '', params),
    queryFn: () => living.billing.invoices(communityId!, params),
    enabled: !!communityId,
  });
}

/** Per-unit / per-resident collection standing (the "who owes what" table). */
export function usePaymentStatusByUnit(communityId: string | null, params: Record<string, unknown>) {
  return useQuery({
    queryKey: billingKeys.byUnit(communityId ?? '', params),
    queryFn: () => living.billing.byUnit(communityId!, params),
    enabled: !!communityId,
  });
}

export function usePaymentsHistory(communityId: string | null, params: Record<string, unknown>) {
  return useQuery({
    queryKey: billingKeys.payments(communityId ?? '', params),
    queryFn: () => living.payments.list(communityId!, params),
    enabled: !!communityId,
  });
}

export function usePaymentConfig(communityId: string | null) {
  return useQuery({
    queryKey: billingKeys.paymentConfig(communityId ?? ''),
    queryFn: () => living.paymentConfig.list(communityId!),
    enabled: !!communityId,
  });
}

/** Any billing write invalidates the whole namespace — cheap and never stale. */
export function useBillingMutation<TInput, TResult>(
  communityId: string | null,
  fn: (communityId: string, input: TInput) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => fn(communityId!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

export function useSavePaymentConfig(communityId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ purpose, input }: { purpose: PaymentPurpose; input: Record<string, unknown> }) =>
      living.paymentConfig.save(communityId!, purpose, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.paymentConfig(communityId ?? '') }),
  });
}

/** ₹ formatting used across every billing surface. */
export function inr(amount: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}
