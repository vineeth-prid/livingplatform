import type { HttpClient } from '../http';

export type CommissionModel = 'PERCENTAGE' | 'FIXED' | 'NONE';
export type PayoutFrequency = 'WEEKLY' | 'MONTHLY';
export type VendorPayoutStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type EarningPayoutStatus = 'UNSETTLED' | 'PENDING' | 'PAID';

export interface CommissionConfig {
  id: string;
  vendorId: string;
  serviceId: string | null;
  model: CommissionModel;
  rate: string | null;
  fixedAmount: string | null;
  payoutFrequency: PayoutFrequency;
  effectiveFrom: string;
  isActive: boolean;
  createdAt: string;
}

export interface CommissionConfigInput {
  model: CommissionModel;
  rate?: number;
  fixedAmount?: number;
  payoutFrequency: PayoutFrequency;
  effectiveFrom: string;
  serviceId?: string;
}

/** One completed service request, as vendor earnings. */
export interface VendorEarning {
  serviceRequestId: string;
  displayNumber: string;
  title: string;
  serviceId: string;
  serviceName: string;
  vendorId: string;
  vendorName: string;
  unitNumber: string | null;
  completedAt: string;
  basis: 'PAID' | 'PACKAGE';
  serviceValue: number;
  commissionModel: CommissionModel;
  commissionRate: number | null;
  commission: number;
  payable: number;
  payoutStatus: EarningPayoutStatus;
  payoutId: string | null;
  payoutNumber: string | null;
  period: { start: string; end: string; frequency: PayoutFrequency };
}

export interface VendorFinanceSummary {
  totalServiceValue: number;
  totalCommission: number;
  totalPayable: number;
  pendingPayout: number;
  unsettledPayable: number;
  paidAmount: number;
  pendingPayoutCount: number;
  paidPayoutCount: number;
  awaitingInvoiceCount: number;
  payoutFrequency: PayoutFrequency | null;
  nextPayoutPeriod: { start: string; end: string; frequency: PayoutFrequency } | null;
}

export interface VendorPayout {
  id: string;
  communityId: string;
  vendorId: string;
  number: string;
  frequency: PayoutFrequency;
  periodStart: string;
  periodEnd: string;
  serviceValue: number;
  commission: number;
  payable: number;
  status: VendorPayoutStatus;
  paidAmount: number | null;
  paidAt: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  vendorInvoiceNumber: string | null;
  vendorInvoiceKey: string | null;
  createdAt: string;
  vendor?: { id: string; name: string; companyName: string | null };
  lineCount?: number;
}

export interface VendorPayoutDetail extends VendorPayout {
  paidByName: string | null;
  vendor: { id: string; name: string; companyName: string | null; phone: string; email: string | null; addressLine: string | null; city: string | null };
  community: {
    name: string; logoUrl: string | null; addressLine1?: string | null; city?: string | null; state?: string | null;
    pincode?: string | null; contactEmail?: string | null; contactPhone?: string | null;
  };
  lines: {
    id: string; serviceRequestId: string; displayNumber: string; title: string; serviceName: string;
    unitNumber: string | null; completedAt: string; basis: string; serviceValue: number;
    commissionModel: CommissionModel; commissionRate: number | null; commission: number; payable: number;
  }[];
}

export interface EarningsQuery {
  vendorId?: string;
  serviceId?: string;
  from?: string;
  to?: string;
  payoutStatus?: EarningPayoutStatus;
  frequency?: PayoutFrequency;
}

/** Vendor commission, payout statements and payout records. */
export class VendorFinanceResource {
  constructor(private readonly http: HttpClient) {}

  private base(communityId: string) {
    return `/communities/${communityId}/vendor-finance`;
  }

  summary(communityId: string, vendorId?: string): Promise<VendorFinanceSummary> {
    return this.http.get(`${this.base(communityId)}/summary`, vendorId ? { vendorId } : undefined);
  }
  transactions(communityId: string, q: EarningsQuery = {}): Promise<VendorEarning[]> {
    return this.http.get(`${this.base(communityId)}/transactions`, q as Record<string, unknown>);
  }
  commission(communityId: string, vendorId: string): Promise<CommissionConfig[]> {
    return this.http.get(`${this.base(communityId)}/vendors/${vendorId}/commission`);
  }
  addCommission(communityId: string, vendorId: string, input: CommissionConfigInput): Promise<CommissionConfig> {
    return this.http.post(`${this.base(communityId)}/vendors/${vendorId}/commission`, input);
  }
  deactivateCommission(communityId: string, id: string): Promise<CommissionConfig> {
    return this.http.post(`${this.base(communityId)}/commission/${id}/deactivate`);
  }
  payouts(communityId: string, q: { vendorId?: string; status?: VendorPayoutStatus; frequency?: PayoutFrequency; from?: string; to?: string } = {}): Promise<VendorPayout[]> {
    return this.http.get(`${this.base(communityId)}/payouts`, q as Record<string, unknown>);
  }
  payout(communityId: string, id: string): Promise<VendorPayoutDetail> {
    return this.http.get(`${this.base(communityId)}/payouts/${id}`);
  }
  generate(communityId: string, vendorId?: string): Promise<{ created: number; payouts: { id: string; number: string }[] }> {
    return this.http.post(`${this.base(communityId)}/payouts/generate`, vendorId ? { vendorId } : {});
  }
  markPaid(communityId: string, id: string, input: { amount: number; paidAt: string; reference: string; method?: string; notes?: string }): Promise<VendorPayout> {
    return this.http.post(`${this.base(communityId)}/payouts/${id}/pay`, input);
  }
  cancel(communityId: string, id: string, reason: string): Promise<VendorPayout> {
    return this.http.post(`${this.base(communityId)}/payouts/${id}/cancel`, { reason });
  }
  invoiceUploadUrl(communityId: string, id: string, fileName: string, contentType?: string): Promise<{ key: string; uploadUrl: string }> {
    return this.http.post(`${this.base(communityId)}/payouts/${id}/invoice/upload-url`, { fileName, contentType });
  }
  setInvoice(communityId: string, id: string, invoiceNumber: string, fileKey?: string): Promise<VendorPayout> {
    return this.http.put(`${this.base(communityId)}/payouts/${id}/invoice`, { invoiceNumber, fileKey });
  }
  invoice(communityId: string, id: string): Promise<{ url: string | null }> {
    return this.http.get(`${this.base(communityId)}/payouts/${id}/invoice`);
  }

  // ── Vendor app (own data only) ──
  mine(communityId: string): Promise<{ summary: VendorFinanceSummary; transactions: VendorEarning[]; payouts: VendorPayout[] }> {
    return this.http.get(`${this.base(communityId)}/me`);
  }
  myPayout(communityId: string, id: string): Promise<VendorPayoutDetail> {
    return this.http.get(`${this.base(communityId)}/me/payouts/${id}`);
  }
  myInvoice(communityId: string, id: string): Promise<{ url: string | null }> {
    return this.http.get(`${this.base(communityId)}/me/payouts/${id}/invoice`);
  }
}
