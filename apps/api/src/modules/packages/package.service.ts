import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ServicePackageStatus } from '@prisma/client';

import { resolveSort } from '../../common/dto/list-query.dto';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { round2 } from '../billing/billing.math';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import type { QueryPackageDto, UpsertPackageDto } from './dto/package.dto';

const SORTABLE = ['sortOrder', 'name', 'price', 'createdAt'] as const;

export interface PackageItemView {
  serviceId: string;
  serviceName: string;
  serviceKey: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface PackageView {
  id: string;
  communityId: string;
  name: string;
  description: string | null;
  price: number;
  /** Sum of the member services at list price. */
  listPrice: number | null;
  /** listPrice − price, when a list price is known. */
  savings: number | null;
  savingsPercent: number | null;
  durationDays: number;
  propertyTypes: string[];
  status: ServicePackageStatus;
  sortOrder: number;
  iconKey: string | null;
  color: string | null;
  items: PackageItemView[];
  /** How many residents have bought it (ACTIVE or COMPLETED). */
  purchaseCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service Packages — a priced BUNDLE of rows that already exist in the Service
 * catalog.
 *
 * Deliberately NOT a second catalog: a package holds `serviceId` references, so
 * a service disabled in the catalog is disabled everywhere, and a package can
 * never invent a service the community does not actually offer.
 *
 * List price (and therefore the advertised saving) is captured at save time
 * from `Service.basePrice`. Freezing it means re-pricing a service later never
 * silently rewrites the saving a resident was shown when they bought.
 */
@Injectable()
export class PackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
  ) {}

  async findMany(
    communityId: string,
    query: QueryPackageDto,
  ): Promise<Paginated<PackageView>> {
    await this.access.assert(communityId);
    const where: Prisma.ServicePackageWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
      // An empty propertyTypes array means "every type", so a filtered query
      // must still return those.
      ...(query.propertyType
        ? { OR: [{ propertyTypes: { isEmpty: true } }, { propertyTypes: { has: query.propertyType } }] }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.servicePackage.findMany({
        where,
        include: PACKAGE_INCLUDE,
        orderBy: resolveSort(query, SORTABLE, 'sortOrder'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.servicePackage.count({ where }),
    ]);
    return paginate(rows.map(toView), total, query);
  }

  /**
   * What a resident may buy: ACTIVE packages offered to their property type.
   * Ordering puts packages before individual services in the app, so `sortOrder`
   * is the merchandising lever a community admin controls.
   */
  async listForResident(communityId: string, propertyType?: string | null): Promise<PackageView[]> {
    await this.access.assert(communityId);
    const rows = await this.prisma.servicePackage.findMany({
      where: {
        communityId,
        deletedAt: null,
        status: ServicePackageStatus.ACTIVE,
        ...(propertyType
          ? { OR: [{ propertyTypes: { isEmpty: true } }, { propertyTypes: { has: propertyType } }] }
          : {}),
      },
      include: PACKAGE_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    // A package whose every service has since been deactivated is not bookable.
    return rows.filter((r) => r.items.some((i) => i.service.isActive)).map(toView);
  }

  async findOne(communityId: string, id: string): Promise<PackageView> {
    await this.access.assert(communityId);
    const row = await this.prisma.servicePackage.findFirst({
      where: { id, communityId, deletedAt: null },
      include: PACKAGE_INCLUDE,
    });
    if (!row) throw new NotFoundException('Package not found');
    const purchaseCount = await this.prisma.servicePackagePurchase.count({
      where: { packageId: id, deletedAt: null, status: { in: ['ACTIVE', 'COMPLETED'] } },
    });
    return { ...toView(row), purchaseCount };
  }

  async create(
    communityId: string,
    dto: UpsertPackageDto,
    actor: AuthenticatedUser,
  ): Promise<PackageView> {
    await this.access.assert(communityId);
    const items = await this.resolveItems(communityId, dto.items);

    const row = await this.prisma.servicePackage.create({
      data: {
        communityId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        listPrice: items.listPrice,
        durationDays: dto.durationDays ?? 90,
        propertyTypes: dto.propertyTypes ?? [],
        status: dto.status ?? ServicePackageStatus.ACTIVE,
        sortOrder: dto.sortOrder ?? 0,
        iconKey: dto.iconKey,
        color: dto.color,
        createdById: actor.id,
        updatedById: actor.id,
        items: { create: items.rows },
      },
      include: PACKAGE_INCLUDE,
    });
    return toView(row);
  }

  async update(
    communityId: string,
    id: string,
    dto: UpsertPackageDto,
    actor: AuthenticatedUser,
  ): Promise<PackageView> {
    await this.access.assert(communityId);
    await this.requirePackage(communityId, id);
    const items = await this.resolveItems(communityId, dto.items);

    // Replace the item set wholesale — it is a small, fully-specified list, and
    // diffing it would add nothing but a chance to leave an orphan row behind.
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.servicePackageItem.deleteMany({ where: { packageId: id } });
      return tx.servicePackage.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          price: dto.price,
          listPrice: items.listPrice,
          durationDays: dto.durationDays,
          propertyTypes: dto.propertyTypes,
          status: dto.status,
          sortOrder: dto.sortOrder,
          iconKey: dto.iconKey,
          color: dto.color,
          updatedById: actor.id,
          items: { create: items.rows },
        },
        include: PACKAGE_INCLUDE,
      });
    });
    return toView(row);
  }

  /** Enable / disable. Packages are never deleted while purchases reference them. */
  async setStatus(
    communityId: string,
    id: string,
    status: ServicePackageStatus,
    actor: AuthenticatedUser,
  ): Promise<PackageView> {
    await this.access.assert(communityId);
    await this.requirePackage(communityId, id);
    const row = await this.prisma.servicePackage.update({
      where: { id },
      data: { status, updatedById: actor.id },
      include: PACKAGE_INCLUDE,
    });
    return toView(row);
  }

  /** Copy a package (items included) as an INACTIVE draft to edit. */
  async duplicate(
    communityId: string,
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PackageView> {
    await this.access.assert(communityId);
    const source = await this.prisma.servicePackage.findFirst({
      where: { id, communityId, deletedAt: null },
      include: { items: true },
    });
    if (!source) throw new NotFoundException('Package not found');

    const row = await this.prisma.servicePackage.create({
      data: {
        communityId,
        name: `${source.name} (copy)`,
        description: source.description,
        price: source.price,
        listPrice: source.listPrice,
        durationDays: source.durationDays,
        propertyTypes: source.propertyTypes,
        // A copy always starts switched off, so duplicating never accidentally
        // publishes a half-edited offer to residents.
        status: ServicePackageStatus.INACTIVE,
        sortOrder: source.sortOrder,
        iconKey: source.iconKey,
        color: source.color,
        createdById: actor.id,
        updatedById: actor.id,
        items: {
          create: source.items.map((i) => ({
            serviceId: i.serviceId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            sortOrder: i.sortOrder,
          })),
        },
      },
      include: PACKAGE_INCLUDE,
    });
    return toView(row);
  }

  async remove(
    communityId: string,
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ id: string; deleted: boolean }> {
    await this.access.assert(communityId);
    await this.requirePackage(communityId, id);
    const purchases = await this.prisma.servicePackagePurchase.count({
      where: { packageId: id, deletedAt: null },
    });
    if (purchases > 0) {
      throw new BadRequestException(
        'This package has been purchased — deactivate it instead of deleting it',
      );
    }
    await this.prisma.servicePackage.update({
      where: { id },
      data: { deletedAt: new Date(), status: ServicePackageStatus.INACTIVE, updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /**
   * Validate the referenced services and compute the frozen list price.
   * Every service must be usable by this community (system default or the
   * community's own tenant) and not soft-deleted.
   */
  private async resolveItems(communityId: string, items: UpsertPackageDto['items']) {
    const community = await this.prisma.community.findUniqueOrThrow({
      where: { id: communityId },
      select: { tenantId: true },
    });
    const ids = [...new Set(items.map((i) => i.serviceId))];
    if (ids.length !== items.length) {
      throw new BadRequestException('A package lists each service once — use quantity instead');
    }

    const services = await this.prisma.service.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        OR: [{ tenantId: null }, { tenantId: community.tenantId }],
      },
      select: { id: true, basePrice: true },
    });
    if (services.length !== ids.length) {
      throw new BadRequestException('One or more services are not available for this community');
    }
    const priceById = new Map(services.map((s) => [s.id, s.basePrice]));

    let listPrice: number | null = 0;
    const rows = items.map((item, index) => {
      const unitPrice = item.unitPrice ?? numberOrNull(priceById.get(item.serviceId));
      if (unitPrice === null) {
        // No list price anywhere → we cannot claim a saving, so don't.
        listPrice = null;
      } else if (listPrice !== null) {
        listPrice = round2(listPrice + unitPrice * item.quantity);
      }
      return {
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPrice,
        sortOrder: item.sortOrder ?? index,
      };
    });

    return { rows, listPrice };
  }

  private async requirePackage(communityId: string, id: string): Promise<void> {
    const row = await this.prisma.servicePackage.findFirst({
      where: { id, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Package not found');
  }
}

// ── Mapping ──────────────────────────────────────────────────────────────────

const PACKAGE_INCLUDE = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { service: { select: { id: true, key: true, name: true, isActive: true } } },
  },
} as const satisfies Prisma.ServicePackageInclude;

type PackageRow = Prisma.ServicePackageGetPayload<{ include: typeof PACKAGE_INCLUDE }>;

function toView(row: PackageRow): PackageView {
  const price = Number(row.price);
  const listPrice = row.listPrice === null ? null : Number(row.listPrice);
  const savings = listPrice === null ? null : round2(Math.max(0, listPrice - price));
  return {
    id: row.id,
    communityId: row.communityId,
    name: row.name,
    description: row.description,
    price,
    listPrice,
    savings,
    savingsPercent:
      listPrice && listPrice > 0 && savings !== null ? Math.round((savings / listPrice) * 100) : null,
    durationDays: row.durationDays,
    propertyTypes: row.propertyTypes,
    status: row.status,
    sortOrder: row.sortOrder,
    iconKey: row.iconKey,
    color: row.color,
    items: row.items.map((i) => ({
      serviceId: i.serviceId,
      serviceKey: i.service.key,
      serviceName: i.service.name,
      quantity: i.quantity,
      unitPrice: numberOrNull(i.unitPrice),
      lineTotal: i.unitPrice === null ? null : round2(Number(i.unitPrice) * i.quantity),
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function numberOrNull(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}
