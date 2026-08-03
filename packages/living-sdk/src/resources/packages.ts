import type { ListParams, Paginated } from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;

export type ServicePackageStatus = 'ACTIVE' | 'INACTIVE';
export type PackagePurchaseStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PackageItem {
  serviceId: string;
  serviceKey: string;
  serviceName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface ServicePackage {
  id: string;
  communityId: string;
  name: string;
  description: string | null;
  price: number;
  listPrice: number | null;
  savings: number | null;
  savingsPercent: number | null;
  durationDays: number;
  propertyTypes: string[];
  status: ServicePackageStatus;
  sortOrder: number;
  iconKey: string | null;
  color: string | null;
  items: PackageItem[];
  purchaseCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackageEntitlement {
  serviceId: string;
  serviceName: string;
  total: number;
  used: number;
  remaining: number;
}

export interface PackagePurchase {
  id: string;
  communityId: string;
  packageId: string;
  packageName: string;
  residentId: string | null;
  unitId: string | null;
  amount: number;
  currency: string;
  status: PackagePurchaseStatus;
  paymentId: string | null;
  purchasedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  daysRemaining: number | null;
  entitlements: PackageEntitlement[];
  createdAt: string;
}

export interface PackageInput {
  name: string;
  description?: string;
  price: number;
  durationDays?: number;
  propertyTypes?: string[];
  status?: ServicePackageStatus;
  sortOrder?: number;
  iconKey?: string;
  color?: string;
  items: Array<{ serviceId: string; quantity: number; unitPrice?: number; sortOrder?: number }>;
}

/**
 * Service Packages — bundles of EXISTING catalog services.
 *
 * Buying goes through the normal payment resource (`payments.checkout` with
 * `packagePurchaseId`), and redeeming produces an ordinary Service Request —
 * there is no package-specific payment or booking call here by design.
 */
export class PackagesResource {
  constructor(private readonly http: HttpClient) {}

  // ── Catalog (community admin) ──
  list(communityId: string, params?: Query): Promise<Paginated<ServicePackage>> {
    return this.http.get(`/communities/${communityId}/packages`, params);
  }
  get(communityId: string, id: string): Promise<ServicePackage> {
    return this.http.get(`/communities/${communityId}/packages/${id}`);
  }
  create(communityId: string, input: PackageInput): Promise<ServicePackage> {
    return this.http.post(`/communities/${communityId}/packages`, input);
  }
  update(communityId: string, id: string, input: PackageInput): Promise<ServicePackage> {
    return this.http.put(`/communities/${communityId}/packages/${id}`, input);
  }
  setStatus(communityId: string, id: string, status: ServicePackageStatus): Promise<ServicePackage> {
    return this.http.patch(`/communities/${communityId}/packages/${id}/status`, { status });
  }
  duplicate(communityId: string, id: string): Promise<ServicePackage> {
    return this.http.post(`/communities/${communityId}/packages/${id}/duplicate`, {});
  }
  remove(communityId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/communities/${communityId}/packages/${id}`);
  }

  // ── Storefront (resident) ──
  /** Active packages this resident may buy, filtered to their property type. */
  available(communityId: string, propertyType?: string): Promise<ServicePackage[]> {
    return this.http.get(`/communities/${communityId}/packages/available`, { propertyType });
  }

  /** Start a purchase — returns a PENDING row to open a checkout for. */
  purchase(
    communityId: string,
    input: { packageId: string; unitId?: string },
  ): Promise<PackagePurchase> {
    return this.http.post(`/communities/${communityId}/packages/purchase`, input);
  }

  // ── Purchases + redemption ──
  purchases(communityId: string, params?: Query): Promise<Paginated<PackagePurchase>> {
    return this.http.get(`/communities/${communityId}/package-purchases`, params);
  }
  purchaseDetail(communityId: string, id: string): Promise<PackagePurchase> {
    return this.http.get(`/communities/${communityId}/package-purchases/${id}`);
  }
  /** Redeem one entitlement — creates an ordinary Service Request. */
  redeem(
    communityId: string,
    purchaseId: string,
    input: { serviceId: string; preferredDate?: string; preferredTimeSlot?: string; notes?: string },
  ): Promise<Record<string, unknown>> {
    return this.http.post(
      `/communities/${communityId}/package-purchases/${purchaseId}/redeem`,
      input,
    );
  }
}

// ── Insights ────────────────────────────────────────────────────────────────

export interface CommunityInsights {
  modules: { maintenanceBilling: boolean; servicePackages: boolean };
  serviceAdoption: {
    residentsUsingServices: number;
    totalResidents: number;
    adoptionPercent: number;
    requestsLast30Days: number;
  };
  mostBookedService: { serviceId: string; name: string; bookings: number } | null;
  mostBookedPackage: { packageId: string; name: string; purchases: number } | null;
  revenue: {
    maintenanceCollected: number | null;
    maintenanceOutstanding: number | null;
    serviceCollected: number;
    packageRevenue: number;
    totalCollected: number;
  };
  topVendors: Array<{ vendorId: string; name: string; completed: number; open: number }>;
}

export interface PlatformBusinessIntelligence {
  communities: {
    total: number;
    active: number;
    maintenanceEnabled: number;
    maintenanceDisabled: number;
    packagesEnabled: number;
  };
  adoption: {
    communitiesCollecting: number;
    communitiesWithPackages: number;
    communitiesSellingPackages: number;
    packageAdoptionPercent: number;
    paymentAdoptionPercent: number;
  };
  popularServices: Array<{ name: string; bookings: number }>;
  popularPackages: Array<{ name: string; purchases: number }>;
  revenue: {
    totalCollected: number;
    averagePerCommunity: number;
    last30Days: number;
    previous30Days: number;
    growthPercent: number | null;
  };
}

/** Business intelligence at both scopes. */
export class InsightsResource {
  constructor(private readonly http: HttpClient) {}

  /** One community's own numbers (tenant-scoped server-side). */
  community(communityId: string): Promise<CommunityInsights> {
    return this.http.get(`/communities/${communityId}/insights`);
  }

  /** Platform aggregates. Contains no per-community financials. */
  platform(): Promise<PlatformBusinessIntelligence> {
    return this.http.get('/admin/stats/business');
  }

  /** Maintenance-billing flag per community (yes/no only). */
  maintenanceEnabled(): Promise<Array<{ communityId: string; enabled: boolean }>> {
    return this.http.get('/admin/stats/maintenance-enabled');
  }
}
