import { Injectable } from '@nestjs/common';
import {
  InvoiceStatus,
  PackagePurchaseStatus,
  PaymentPurpose,
  PaymentStatus,
} from '@prisma/client';

import { round2 } from '../billing/billing.math';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CommunityAccessService } from '../tenancy/community-access.service';

export interface CommunityInsights {
  /** Which optional modules this community runs — drives what the UI shows. */
  modules: { maintenanceBilling: boolean; servicePackages: boolean };

  serviceAdoption: {
    /** Residents who have raised at least one service request. */
    residentsUsingServices: number;
    totalResidents: number;
    adoptionPercent: number;
    requestsLast30Days: number;
  };

  mostBookedService: { serviceId: string; name: string; bookings: number } | null;
  mostBookedPackage: { packageId: string; name: string; purchases: number } | null;

  revenue: {
    /** Null when maintenance billing is off for this community. */
    maintenanceCollected: number | null;
    maintenanceOutstanding: number | null;
    serviceCollected: number;
    packageRevenue: number;
    totalCollected: number;
  };

  topVendors: Array<{
    vendorId: string;
    name: string;
    completed: number;
    open: number;
  }>;
}

/**
 * Business intelligence for ONE community.
 *
 * Every number is a live read, scoped through `CommunityAccessService.assert`,
 * so a caller can only ever see their own community's figures. Metrics whose
 * module is switched off return `null` rather than `0` — "we don't collect
 * maintenance here" and "we collected nothing" are different facts and the UI
 * renders them differently.
 */
@Injectable()
export class CommunityInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly settings: SettingsService,
  ) {}

  async overview(communityId: string): Promise<CommunityInsights> {
    await this.access.assert(communityId);
    const modules = await this.settings.features(communityId);
    const since30 = new Date(Date.now() - 30 * 86_400_000);

    const [
      totalResidents,
      requestsLast30Days,
      residentsWithRequests,
      serviceTally,
      packageTally,
      servicePayments,
      packagePurchases,
      vendorStats,
    ] = await Promise.all([
      this.prisma.resident.count({ where: { communityId, deletedAt: null } }),
      this.prisma.serviceRequest.count({
        where: { communityId, deletedAt: null, createdAt: { gte: since30 } },
      }),
      this.prisma.serviceRequest.findMany({
        where: { communityId, deletedAt: null, residentId: { not: null } },
        distinct: ['residentId'],
        select: { residentId: true },
      }),
      this.prisma.serviceRequest.groupBy({
        by: ['serviceId'],
        where: { communityId, deletedAt: null },
        _count: { _all: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 1,
      }),
      this.prisma.servicePackagePurchase.groupBy({
        by: ['packageId'],
        where: {
          communityId,
          deletedAt: null,
          status: { in: [PackagePurchaseStatus.ACTIVE, PackagePurchaseStatus.COMPLETED] },
        },
        _count: { _all: true },
        orderBy: { _count: { packageId: 'desc' } },
        take: 1,
      }),
      this.prisma.payment.aggregate({
        where: {
          communityId,
          deletedAt: null,
          purpose: PaymentPurpose.SERVICE,
          status: PaymentStatus.PAID,
        },
        _sum: { amount: true },
      }),
      this.prisma.servicePackagePurchase.aggregate({
        where: {
          communityId,
          deletedAt: null,
          status: { in: [PackagePurchaseStatus.ACTIVE, PackagePurchaseStatus.COMPLETED] },
        },
        _sum: { amount: true },
      }),
      this.vendorPerformance(communityId),
    ]);

    // Maintenance figures only exist when the module is on.
    const maintenance = modules.maintenanceBilling
      ? await this.prisma.maintenanceInvoice.aggregate({
          where: { communityId, deletedAt: null, status: { not: InvoiceStatus.CANCELLED } },
          _sum: { totalAmount: true, paidAmount: true },
        })
      : null;
    const maintenanceCollected = maintenance ? round2(Number(maintenance._sum.paidAmount ?? 0)) : null;
    const maintenanceOutstanding = maintenance
      ? round2(Number(maintenance._sum.totalAmount ?? 0) - Number(maintenance._sum.paidAmount ?? 0))
      : null;

    const serviceCollected = round2(Number(servicePayments._sum.amount ?? 0));
    const packageRevenue = round2(Number(packagePurchases._sum.amount ?? 0));

    const [topService, topPackage] = await Promise.all([
      this.nameTopService(serviceTally[0]),
      this.nameTopPackage(packageTally[0]),
    ]);

    const usingServices = residentsWithRequests.length;
    return {
      modules,
      serviceAdoption: {
        residentsUsingServices: usingServices,
        totalResidents,
        adoptionPercent: totalResidents > 0 ? Math.round((usingServices / totalResidents) * 100) : 0,
        requestsLast30Days,
      },
      mostBookedService: topService,
      mostBookedPackage: topPackage,
      revenue: {
        maintenanceCollected,
        maintenanceOutstanding,
        serviceCollected,
        packageRevenue,
        // Package revenue is collected on the SERVICE rail, so it is already
        // inside serviceCollected — do not add it twice.
        totalCollected: round2((maintenanceCollected ?? 0) + serviceCollected),
      },
      topVendors: vendorStats,
    };
  }

  /** Vendors ranked by completed work in this community. */
  private async vendorPerformance(communityId: string) {
    const [completed, open] = await Promise.all([
      this.prisma.serviceRequest.groupBy({
        by: ['assignedVendorId'],
        where: {
          communityId,
          deletedAt: null,
          assignedVendorId: { not: null },
          status: 'COMPLETED',
        },
        _count: { _all: true },
      }),
      this.prisma.serviceRequest.groupBy({
        by: ['assignedVendorId'],
        where: {
          communityId,
          deletedAt: null,
          assignedVendorId: { not: null },
          status: { in: ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS'] },
        },
        _count: { _all: true },
      }),
    ]);

    const byId = new Map<string, { completed: number; open: number }>();
    for (const row of completed) {
      if (row.assignedVendorId) byId.set(row.assignedVendorId, { completed: row._count._all, open: 0 });
    }
    for (const row of open) {
      if (!row.assignedVendorId) continue;
      const entry = byId.get(row.assignedVendorId) ?? { completed: 0, open: 0 };
      entry.open = row._count._all;
      byId.set(row.assignedVendorId, entry);
    }
    if (byId.size === 0) return [];

    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: [...byId.keys()] } },
      select: { id: true, name: true },
    });
    return vendors
      .map((v) => ({
        vendorId: v.id,
        name: v.name,
        completed: byId.get(v.id)?.completed ?? 0,
        open: byId.get(v.id)?.open ?? 0,
      }))
      .sort((a, b) => b.completed - a.completed || b.open - a.open)
      .slice(0, 5);
  }

  private async nameTopService(row: { serviceId: string; _count: { _all: number } } | undefined) {
    if (!row) return null;
    const service = await this.prisma.service.findUnique({
      where: { id: row.serviceId },
      select: { name: true },
    });
    return service
      ? { serviceId: row.serviceId, name: service.name, bookings: row._count._all }
      : null;
  }

  private async nameTopPackage(row: { packageId: string; _count: { _all: number } } | undefined) {
    if (!row) return null;
    const pkg = await this.prisma.servicePackage.findUnique({
      where: { id: row.packageId },
      select: { name: true },
    });
    return pkg ? { packageId: row.packageId, name: pkg.name, purchases: row._count._all } : null;
  }
}
