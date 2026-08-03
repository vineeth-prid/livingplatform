import { Injectable } from '@nestjs/common';
import {
  CommunityStatus,
  PackagePurchaseStatus,
  PaymentPurpose,
  PaymentStatus,
} from '@prisma/client';

import { round2 } from '../billing/billing.math';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export interface PlatformBusinessIntelligence {
  communities: {
    total: number;
    active: number;
    maintenanceEnabled: number;
    maintenanceDisabled: number;
    packagesEnabled: number;
  };

  adoption: {
    /** Communities that have taken at least one payment. */
    communitiesCollecting: number;
    /** Communities that have published at least one package. */
    communitiesWithPackages: number;
    /** Communities where a resident has actually bought a package. */
    communitiesSellingPackages: number;
    packageAdoptionPercent: number;
    paymentAdoptionPercent: number;
  };

  /** Popularity across the platform, by name — never per community. */
  popularServices: Array<{ name: string; bookings: number }>;
  popularPackages: Array<{ name: string; purchases: number }>;

  /**
   * Aggregate only. Deliberately NO per-community revenue: the platform
   * operator sees the size and shape of the business, not any association's
   * books.
   */
  revenue: {
    totalCollected: number;
    averagePerCommunity: number;
    last30Days: number;
    previous30Days: number;
    growthPercent: number | null;
  };
}

/**
 * Platform-wide business intelligence.
 *
 * The hard rule here is the one from the brief: **do not expose community
 * financial data.** Every figure is either a count of communities or a sum
 * across ALL of them; nothing in this response can be attributed back to a
 * single association. Per-community money lives behind
 * `CommunityInsightsService`, which is tenant-scoped.
 */
@Injectable()
export class PlatformBusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async overview(): Promise<PlatformBusinessIntelligence> {
    const now = Date.now();
    const since30 = new Date(now - 30 * 86_400_000);
    const since60 = new Date(now - 60 * 86_400_000);

    const communities = await this.prisma.community.findMany({
      where: { deletedAt: null },
      select: { id: true, status: true },
    });
    const communityIds = communities.map((c) => c.id);

    const [
      settingsRows,
      collectingCommunities,
      packageCommunities,
      sellingCommunities,
      serviceTally,
      packageTally,
      totals,
      last30,
      previous30,
    ] = await Promise.all([
      this.prisma.communitySettings.findMany({
        where: { communityId: { in: communityIds } },
        select: { maintenanceBillingEnabled: true, servicePackagesEnabled: true },
      }),
      this.prisma.payment.findMany({
        where: { deletedAt: null, status: PaymentStatus.PAID },
        distinct: ['communityId'],
        select: { communityId: true },
      }),
      this.prisma.servicePackage.findMany({
        where: { deletedAt: null },
        distinct: ['communityId'],
        select: { communityId: true },
      }),
      this.prisma.servicePackagePurchase.findMany({
        where: {
          deletedAt: null,
          status: { in: [PackagePurchaseStatus.ACTIVE, PackagePurchaseStatus.COMPLETED] },
        },
        distinct: ['communityId'],
        select: { communityId: true },
      }),
      this.prisma.serviceRequest.groupBy({
        by: ['serviceId'],
        where: { deletedAt: null },
        _count: { _all: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5,
      }),
      this.prisma.servicePackagePurchase.groupBy({
        by: ['packageId'],
        where: {
          deletedAt: null,
          status: { in: [PackagePurchaseStatus.ACTIVE, PackagePurchaseStatus.COMPLETED] },
        },
        _count: { _all: true },
        orderBy: { _count: { packageId: 'desc' } },
        take: 5,
      }),
      this.prisma.payment.aggregate({
        where: { deletedAt: null, status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { deletedAt: null, status: PaymentStatus.PAID, paidAt: { gte: since30 } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          deletedAt: null,
          status: PaymentStatus.PAID,
          paidAt: { gte: since60, lt: since30 },
        },
        _sum: { amount: true },
      }),
    ]);

    // Communities without a settings row run on the defaults (both modules on).
    const withRows = settingsRows.length;
    const missingRows = communities.length - withRows;
    const maintenanceEnabled =
      settingsRows.filter((s) => s.maintenanceBillingEnabled).length + missingRows;
    const packagesEnabled =
      settingsRows.filter((s) => s.servicePackagesEnabled).length + missingRows;

    const total = communities.length;
    const collected = round2(Number(totals._sum.amount ?? 0));
    const recent = round2(Number(last30._sum.amount ?? 0));
    const prior = round2(Number(previous30._sum.amount ?? 0));

    const [popularServices, popularPackages] = await Promise.all([
      this.nameServices(serviceTally),
      this.namePackages(packageTally),
    ]);

    return {
      communities: {
        total,
        active: communities.filter((c) => c.status === CommunityStatus.ACTIVE).length,
        maintenanceEnabled,
        maintenanceDisabled: total - maintenanceEnabled,
        packagesEnabled,
      },
      adoption: {
        communitiesCollecting: collectingCommunities.length,
        communitiesWithPackages: packageCommunities.length,
        communitiesSellingPackages: sellingCommunities.length,
        packageAdoptionPercent: percent(sellingCommunities.length, total),
        paymentAdoptionPercent: percent(collectingCommunities.length, total),
      },
      popularServices,
      popularPackages,
      revenue: {
        totalCollected: collected,
        averagePerCommunity: total > 0 ? round2(collected / total) : 0,
        last30Days: recent,
        previous30Days: prior,
        // No prior period → growth is undefined, not "0%" and not "100%".
        growthPercent: prior > 0 ? Math.round(((recent - prior) / prior) * 100) : null,
      },
    };
  }

  /** Maintenance-enabled flag per community, for the admin communities table. */
  async maintenanceByCommunity(): Promise<Array<{ communityId: string; enabled: boolean }>> {
    const communities = await this.prisma.community.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    const enabled = await this.settings.maintenanceEnabledByCommunity(communities.map((c) => c.id));
    return communities.map((c) => ({ communityId: c.id, enabled: enabled.get(c.id) ?? true }));
  }

  private async nameServices(rows: Array<{ serviceId: string; _count: { _all: number } }>) {
    if (rows.length === 0) return [];
    const services = await this.prisma.service.findMany({
      where: { id: { in: rows.map((r) => r.serviceId) } },
      select: { id: true, name: true },
    });
    const byId = new Map(services.map((s) => [s.id, s.name]));
    return rows
      .map((r) => ({ name: byId.get(r.serviceId) ?? 'Unknown', bookings: r._count._all }))
      .filter((r) => r.name !== 'Unknown');
  }

  /**
   * Package names are community-authored, so several communities may run a
   * package with the same name. Merging by name is what keeps this an aggregate
   * rather than a per-community leaderboard.
   */
  private async namePackages(rows: Array<{ packageId: string; _count: { _all: number } }>) {
    if (rows.length === 0) return [];
    const packages = await this.prisma.servicePackage.findMany({
      where: { id: { in: rows.map((r) => r.packageId) } },
      select: { id: true, name: true },
    });
    const byId = new Map(packages.map((p) => [p.id, p.name]));
    const merged = new Map<string, number>();
    for (const row of rows) {
      const name = byId.get(row.packageId);
      if (!name) continue;
      merged.set(name, (merged.get(name) ?? 0) + row._count._all);
    }
    return [...merged.entries()]
      .map(([name, purchases]) => ({ name, purchases }))
      .sort((a, b) => b.purchases - a.purchases);
  }
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Re-exported so the controller can reference the rail without importing Prisma. */
export const SERVICE_RAIL = PaymentPurpose.SERVICE;
