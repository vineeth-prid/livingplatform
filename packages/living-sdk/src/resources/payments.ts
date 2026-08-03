import type { ListParams, Paginated } from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;

export type PaymentPurpose = 'MAINTENANCE' | 'SERVICE';
export type PaymentGatewayMode = 'TEST' | 'LIVE';
export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

/** Gateway configuration status. Note the absence of any secret field. */
export interface PaymentConfigStatus {
  purpose: PaymentPurpose;
  provider: string;
  mode: PaymentGatewayMode;
  accountName: string | null;
  merchantId: string | null;
  keyIdMasked: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  enabled: boolean;
  ready: boolean;
  updatedAt: string | null;
}

export interface PaymentConfigInput {
  mode?: PaymentGatewayMode;
  accountName?: string;
  merchantId?: string;
  keyId?: string;
  /** Write-only. Omit to keep the stored secret; send '' to clear it. */
  keySecret?: string;
  /** Write-only. */
  webhookSecret?: string;
  enabled?: boolean;
}

export interface CheckoutSession {
  paymentId: string;
  orderId: string;
  keyId: string;
  amount: number;
  amountMinor: number;
  currency: string;
  purpose: PaymentPurpose;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}

export interface Payment {
  id: string;
  communityId: string;
  purpose: PaymentPurpose;
  invoiceId: string | null;
  invoiceNumber: string | null;
  serviceRequestId: string | null;
  unitId: string | null;
  residentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: string;
  method: string | null;
  receiptNumber: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  refundAmount: number | null;
  createdAt: string;
}

export interface MaintenanceCharge {
  id: string;
  communityId: string;
  propertyType: string;
  monthlyAmount: number;
  quarterlyAmount: number | null;
  yearlyAmount: number | null;
  lateFeeAmount: number;
  lateFeePercent: number;
  gracePeriodDays: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  current: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceInvoice {
  id: string;
  communityId: string;
  unitId: string;
  unitNumber: string | null;
  propertyType: string | null;
  residentId: string | null;
  residentName: string | null;
  invoiceNumber: string;
  cycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  baseAmount: number;
  lateFee: number;
  adjustment: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  daysOverdue: number;
  paidAt: string | null;
  notes: string | null;
}

export interface CollectionSummary {
  billed: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  invoiceCount: number;
  unitCount: number;
  byStatus: Array<{ status: InvoiceStatus; count: number; billed: number; collected: number }>;
  monthlyCollection: Array<{ month: string; amount: number }>;
}

export interface ResidentDues {
  outstanding: number;
  currentDue: MaintenanceInvoice | null;
  nextDue: MaintenanceInvoice | null;
  overdueCount: number;
  recent: MaintenanceInvoice[];
}

export interface GenerationResult {
  cycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  created: number;
  skipped: number;
  unpriced: number;
  totalBilled: number;
  dryRun: boolean;
  missingRates: string[];
}

/**
 * Community payment configuration — two independent Razorpay rails.
 * Secrets travel one way only: they can be written, never read back.
 */
export class PaymentConfigResource {
  constructor(private readonly http: HttpClient) {}

  list(communityId: string): Promise<PaymentConfigStatus[]> {
    return this.http.get(`/communities/${communityId}/payment-config`);
  }
  get(communityId: string, purpose: PaymentPurpose): Promise<PaymentConfigStatus> {
    return this.http.get(`/communities/${communityId}/payment-config/${purpose}`);
  }
  save(
    communityId: string,
    purpose: PaymentPurpose,
    input: PaymentConfigInput,
  ): Promise<PaymentConfigStatus> {
    return this.http.put(`/communities/${communityId}/payment-config/${purpose}`, input);
  }
  verify(communityId: string, purpose: PaymentPurpose): Promise<{ ok: boolean; reason?: string }> {
    return this.http.post(`/communities/${communityId}/payment-config/${purpose}/verify`, {});
  }
  /** Platform Admin: readiness across communities (status only). */
  platformOverview(): Promise<
    Array<{ communityId: string; communityName: string; maintenanceReady: boolean; serviceReady: boolean }>
  > {
    return this.http.get('/admin/payment-config');
  }
}

/** Collection: checkout, verification, refunds and transaction history. */
export class PaymentsResource {
  constructor(private readonly http: HttpClient) {}

  list(communityId: string, params?: Query): Promise<Paginated<Payment>> {
    return this.http.get(`/communities/${communityId}/payments`, params);
  }
  get(communityId: string, id: string): Promise<Payment> {
    return this.http.get(`/communities/${communityId}/payments/${id}`);
  }
  receipt(communityId: string, id: string): Promise<Record<string, unknown>> {
    return this.http.get(`/communities/${communityId}/payments/${id}/receipt`);
  }
  /**
   * Open a checkout. Exactly one target: a maintenance invoice, a service
   * request, or a package purchase. The server derives the amount from that
   * target — `amount` is only honoured for an ad-hoc service payment.
   */
  checkout(
    communityId: string,
    input: {
      purpose: PaymentPurpose;
      invoiceId?: string;
      serviceRequestId?: string;
      packagePurchaseId?: string;
      amount?: number;
    },
  ): Promise<CheckoutSession> {
    return this.http.post(`/communities/${communityId}/payments/checkout`, input);
  }
  verify(
    communityId: string,
    input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ): Promise<Payment> {
    return this.http.post(`/communities/${communityId}/payments/verify`, input);
  }
  refund(communityId: string, id: string, amount?: number, reason?: string): Promise<Payment> {
    return this.http.post(`/communities/${communityId}/payments/${id}/refund`, { amount, reason });
  }
}

/** Maintenance rate cards + invoices + the collection dashboard. */
export class BillingResource {
  constructor(private readonly http: HttpClient) {}

  // ── Charges ──
  charges(communityId: string, params?: Query): Promise<Paginated<MaintenanceCharge>> {
    return this.http.get(`/communities/${communityId}/maintenance-charges`, params);
  }
  currentCharges(communityId: string): Promise<MaintenanceCharge[]> {
    return this.http.get(`/communities/${communityId}/maintenance-charges/current`);
  }
  propertyTypes(
    communityId: string,
  ): Promise<Array<{ type: string; unitCount: number; configured: boolean }>> {
    return this.http.get(`/communities/${communityId}/maintenance-charges/property-types`);
  }
  createCharge(communityId: string, input: Record<string, unknown>): Promise<MaintenanceCharge> {
    return this.http.post(`/communities/${communityId}/maintenance-charges`, input);
  }
  updateCharge(
    communityId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<MaintenanceCharge> {
    return this.http.patch(`/communities/${communityId}/maintenance-charges/${id}`, input);
  }
  deleteCharge(communityId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/communities/${communityId}/maintenance-charges/${id}`);
  }

  // ── Invoices ──
  invoices(communityId: string, params?: Query): Promise<Paginated<MaintenanceInvoice>> {
    return this.http.get(`/communities/${communityId}/maintenance-invoices`, params);
  }
  invoice(communityId: string, id: string): Promise<MaintenanceInvoice> {
    return this.http.get(`/communities/${communityId}/maintenance-invoices/${id}`);
  }
  myDues(communityId: string): Promise<ResidentDues> {
    return this.http.get(`/communities/${communityId}/maintenance-invoices/my-dues`);
  }
  summary(communityId: string, months?: number): Promise<CollectionSummary> {
    return this.http.get(`/communities/${communityId}/maintenance-invoices/summary`, { months });
  }
  byUnit(communityId: string, params?: Query): Promise<Paginated<Record<string, unknown>>> {
    return this.http.get(`/communities/${communityId}/maintenance-invoices/by-unit`, params);
  }
  generate(communityId: string, input: Record<string, unknown>): Promise<GenerationResult> {
    return this.http.post(`/communities/${communityId}/maintenance-invoices/generate`, input);
  }
  refreshOverdue(communityId: string): Promise<{ updated: number; lateFeesAdded: number }> {
    return this.http.post(`/communities/${communityId}/maintenance-invoices/refresh-overdue`, {});
  }
  updateInvoice(
    communityId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<MaintenanceInvoice> {
    return this.http.patch(`/communities/${communityId}/maintenance-invoices/${id}`, input);
  }
  recordPayment(
    communityId: string,
    id: string,
    input: { amount: number; method?: string; reference?: string; paidAt?: string },
  ): Promise<MaintenanceInvoice> {
    return this.http.post(
      `/communities/${communityId}/maintenance-invoices/${id}/record-payment`,
      input,
    );
  }
  cancelInvoice(communityId: string, id: string): Promise<{ id: string; cancelled: boolean }> {
    return this.http.delete(`/communities/${communityId}/maintenance-invoices/${id}`);
  }
}
