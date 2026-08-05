import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PackagePurchaseStatus,
  Prisma,
  ServicePackageStatus,
  ServiceRequestStatus,
} from '@prisma/client';

import { resolveSort } from '../../common/dto/list-query.dto';
import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { myResidentIds } from '../community-ops/resident-access';
import { DomainEventName, type PaymentEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { ServiceRequestService } from '../service-request/service-request.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import type {
  PurchasePackageDto,
  QueryPurchaseDto,
  RedeemPackageDto,
} from './dto/package.dto';

const SORTABLE = ['createdAt', 'purchasedAt', 'amount', 'status'] as const;

/** Statuses that still count as "this entitlement was used". */
const CONSUMING_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.REQUESTED,
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.SCHEDULED,
  ServiceRequestStatus.IN_PROGRESS,
  ServiceRequestStatus.COMPLETED,
];

export interface EntitlementView {
  serviceId: string;
  serviceName: string;
  total: number;
  used: number;
  remaining: number;
}

export interface PurchaseView {
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
  purchasedAt: Date | null;
  validFrom: Date | null;
  validUntil: Date | null;
  daysRemaining: number | null;
  /** Set while the activation lead time is still running; null once bookable. */
  bookableFrom: Date | null;
  entitlements: EntitlementView[];
  createdAt: Date;
}

/**
 * Buying and redeeming a Service Package.
 *
 * Two rules keep this from becoming a second booking engine:
 *
 *   • **Payment** is the existing Payment Engine on the SERVICE rail. This
 *     service never touches a gateway; it creates a PENDING purchase, the
 *     payment module collects, and the `payment.succeeded` domain event
 *     activates the purchase.
 *   • **Redemption** is an ordinary ServiceRequest carrying
 *     `packagePurchaseId`. Remaining balance is DERIVED by counting those
 *     requests, so there is no separate counter that can drift, and a redeemed
 *     visit shows up in the resident's normal requests list like any other.
 */
@Injectable()
export class PackagePurchaseService {
  private readonly logger = new Logger(PackagePurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly serviceRequests: ServiceRequestService,
  ) {}

  // ── Buying ─────────────────────────────────────────────────────────────────

  /**
   * Create the purchase in PENDING. The caller then opens a checkout for it
   * through the payment module; nothing is redeemable until that settles.
   */
  async purchase(
    communityId: string,
    dto: PurchasePackageDto,
    actor: AuthenticatedUser,
  ): Promise<PurchaseView> {
    await this.access.assert(communityId);

    const pkg = await this.prisma.servicePackage.findFirst({
      where: { id: dto.packageId, communityId, deletedAt: null },
      include: { items: { include: { service: { select: { name: true, isActive: true } } } } },
    });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.status !== ServicePackageStatus.ACTIVE) {
      throw new BadRequestException('This package is not currently available');
    }
    if (!pkg.items.some((i) => i.service.isActive)) {
      throw new BadRequestException('None of the services in this package are currently available');
    }

    const { residentId, unitId } = await this.resolveBuyer(communityId, dto.unitId, actor);
    if (!residentId) {
      throw new BadRequestException('Only a resident of this community can buy a package');
    }
    await this.assertPropertyTypeAllowed(pkg.propertyTypes, unitId);

    const purchase = await this.prisma.servicePackagePurchase.create({
      data: {
        communityId,
        packageId: pkg.id,
        residentId,
        unitId,
        userId: actor.id,
        amount: pkg.price,
        status: PackagePurchaseStatus.PENDING,
        // Freeze what was bought — the package may be edited or retired later.
        snapshot: {
          name: pkg.name,
          price: Number(pkg.price),
          durationDays: pkg.durationDays,
          items: pkg.items.map((i) => ({
            serviceId: i.serviceId,
            serviceName: i.service.name,
            quantity: i.quantity,
          })),
        } as Prisma.InputJsonValue,
        createdById: actor.id,
      },
    });
    return this.present(purchase.id);
  }

  /**
   * Activate a purchase once its payment settles.
   *
   * Driven by the existing `payment.succeeded` domain event rather than a call
   * from the payment module, so the payment engine keeps knowing nothing about
   * packages. Idempotent: a purchase already ACTIVE is left alone, which makes
   * the checkout-callback and webhook race harmless here too.
   */
  @OnEvent(DomainEventName.PaymentSucceeded, { async: true })
  async onPaymentSucceeded(event: PaymentEvent): Promise<void> {
    try {
      const purchase = await this.prisma.servicePackagePurchase.findFirst({
        where: { paymentId: event.entityId, status: PackagePurchaseStatus.PENDING, deletedAt: null },
        include: { package: { select: { durationDays: true, activationDelayDays: true } } },
      });
      if (!purchase) return;

      const now = new Date();
      // The window runs from the ACTIVATION date, not the purchase date: a
      // package with a two-day lead time would otherwise silently lose two days
      // of the validity the resident paid for.
      const validFrom = new Date(
        now.getTime() + purchase.package.activationDelayDays * 86_400_000,
      );
      const validUntil = new Date(
        validFrom.getTime() + purchase.package.durationDays * 86_400_000,
      );
      await this.prisma.servicePackagePurchase.update({
        where: { id: purchase.id },
        data: {
          status: PackagePurchaseStatus.ACTIVE,
          purchasedAt: now,
          validFrom,
          validUntil,
        },
      });
      this.logger.log(
        `Package purchase ${purchase.id} activated — bookable ${validFrom.toISOString()} → ${validUntil.toISOString()}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to activate a package purchase for payment ${event.entityId}`,
        err as Error,
      );
    }
  }

  // ── Redeeming ──────────────────────────────────────────────────────────────

  /**
   * Redeem one entitlement — creates an ordinary Service Request through the
   * existing engine (which also runs auto vendor assignment and the normal
   * notifications). No package-specific booking path exists.
   */
  async redeem(
    communityId: string,
    purchaseId: string,
    dto: RedeemPackageDto,
    actor: AuthenticatedUser,
  ) {
    await this.access.assert(communityId);
    const purchase = await this.requirePurchase(communityId, purchaseId);
    await this.assertOwner(communityId, purchase.residentId, actor);

    if (purchase.status !== PackagePurchaseStatus.ACTIVE) {
      throw new BadRequestException(
        purchase.status === PackagePurchaseStatus.PENDING
          ? 'This package has not been paid for yet'
          : `This package is ${purchase.status.toLowerCase()}`,
      );
    }
    // The window is a range, not just an expiry. A package bought today with a
    // two-day lead time is ACTIVE and paid for, but not yet bookable — saying
    // exactly when it opens is the difference between a rule and a dead end.
    if (purchase.validFrom && purchase.validFrom.getTime() > Date.now()) {
      throw new BadRequestException(
        `This package can be booked from ${purchase.validFrom.toDateString()}`,
      );
    }
    if (purchase.validUntil && purchase.validUntil.getTime() < Date.now()) {
      await this.prisma.servicePackagePurchase.update({
        where: { id: purchase.id },
        data: { status: PackagePurchaseStatus.EXPIRED },
      });
      throw new BadRequestException('This package has expired');
    }
    if (!purchase.unitId) {
      throw new BadRequestException('This purchase is not linked to a unit');
    }

    const entitlements = await this.entitlements(purchase.id, purchase.packageId);
    const entitlement = entitlements.find((e) => e.serviceId === dto.serviceId);
    if (!entitlement) {
      throw new BadRequestException('That service is not part of this package');
    }
    if (entitlement.remaining <= 0) {
      throw new BadRequestException(`No ${entitlement.serviceName} visits remaining in this package`);
    }

    const request = await this.serviceRequests.create(
      communityId,
      {
        unitId: purchase.unitId,
        serviceId: dto.serviceId,
        residentId: purchase.residentId ?? undefined,
        title: entitlement.serviceName,
        description: `Redeemed from package purchase ${purchase.id}`,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined,
        preferredTimeSlot: dto.preferredTimeSlot,
        notes: dto.notes,
      } as Parameters<ServiceRequestService['create']>[1],
      actor,
      { packagePurchaseId: purchase.id },
    );

    // Fully redeemed → close the purchase out so it stops showing as spendable.
    const after = await this.entitlements(purchase.id, purchase.packageId);
    if (after.every((e) => e.remaining <= 0)) {
      await this.prisma.servicePackagePurchase.update({
        where: { id: purchase.id },
        data: { status: PackagePurchaseStatus.COMPLETED },
      });
    }
    return request;
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  async findMany(
    communityId: string,
    query: QueryPurchaseDto,
    actor: AuthenticatedUser,
  ): Promise<Paginated<PurchaseView>> {
    await this.access.assert(communityId);
    const where: Prisma.ServicePackagePurchaseWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.packageId ? { packageId: query.packageId } : {}),
      ...(await this.residentScope(communityId, query.residentId, actor)),
    };

    const [rows, total] = await Promise.all([
      this.prisma.servicePackagePurchase.findMany({
        where,
        include: { package: { select: { name: true } } },
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.servicePackagePurchase.count({ where }),
    ]);

    const views = await Promise.all(rows.map((r) => this.toView(r)));
    return paginate(views, total, query);
  }

  async findOne(
    communityId: string,
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PurchaseView> {
    await this.access.assert(communityId);
    const purchase = await this.requirePurchase(communityId, id);
    await this.assertOwner(communityId, purchase.residentId, actor);
    return this.present(id);
  }

  /**
   * Remaining balance per service, derived by counting the Service Requests
   * this purchase produced. A cancelled request gives the entitlement back.
   */
  async entitlements(purchaseId: string, packageId: string): Promise<EntitlementView[]> {
    const [items, used] = await Promise.all([
      this.prisma.servicePackageItem.findMany({
        where: { packageId },
        include: { service: { select: { name: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.serviceRequest.groupBy({
        by: ['serviceId'],
        where: {
          packagePurchaseId: purchaseId,
          deletedAt: null,
          status: { in: CONSUMING_STATUSES },
        },
        _count: { _all: true },
      }),
    ]);
    const usedById = new Map(used.map((u) => [u.serviceId, u._count._all]));

    return items.map((item) => {
      const consumed = usedById.get(item.serviceId) ?? 0;
      return {
        serviceId: item.serviceId,
        serviceName: item.service.name,
        total: item.quantity,
        used: consumed,
        remaining: Math.max(0, item.quantity - consumed),
      };
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async present(id: string): Promise<PurchaseView> {
    const row = await this.prisma.servicePackagePurchase.findUniqueOrThrow({
      where: { id },
      include: { package: { select: { name: true } } },
    });
    return this.toView(row);
  }

  private async toView(
    row: Prisma.ServicePackagePurchaseGetPayload<{ include: { package: { select: { name: true } } } }>,
  ): Promise<PurchaseView> {
    return {
      id: row.id,
      communityId: row.communityId,
      packageId: row.packageId,
      packageName: row.package.name,
      residentId: row.residentId,
      unitId: row.unitId,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      paymentId: row.paymentId,
      purchasedAt: row.purchasedAt,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      daysRemaining: row.validUntil
        ? Math.max(0, Math.ceil((row.validUntil.getTime() - Date.now()) / 86_400_000))
        : null,
      // Paid for, but the lead time has not elapsed. The app needs to say
      // "bookable from the 8th" rather than offering a Book button that fails.
      bookableFrom: row.validFrom && row.validFrom.getTime() > Date.now() ? row.validFrom : null,
      entitlements: await this.entitlements(row.id, row.packageId),
      createdAt: row.createdAt,
    };
  }

  private async requirePurchase(communityId: string, id: string) {
    const row = await this.prisma.servicePackagePurchase.findFirst({
      where: { id, communityId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Package purchase not found');
    return row;
  }

  /** Which resident + unit this purchase is for. */
  private async resolveBuyer(
    communityId: string,
    requestedUnitId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<{ residentId: string | null; unitId: string | null }> {
    const mine = await myResidentIds(this.prisma, actor, communityId);
    const residentId = mine[0] ?? null;
    if (!residentId) return { residentId: null, unitId: null };

    const assignment = await this.prisma.residentUnit.findUnique({
      where: { residentId },
      select: { unitId: true },
    });
    const unitId = requestedUnitId ?? assignment?.unitId ?? null;

    if (requestedUnitId) {
      const owned = await this.prisma.unit.findFirst({
        where: { id: requestedUnitId, communityId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new BadRequestException('That unit is not in this community');
    }
    return { residentId, unitId };
  }

  /** A package restricted to property types is only sold to matching units. */
  private async assertPropertyTypeAllowed(
    propertyTypes: string[],
    unitId: string | null,
  ): Promise<void> {
    if (propertyTypes.length === 0) return;
    if (!unitId) {
      throw new BadRequestException('This package is limited to specific property types');
    }
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { type: true },
    });
    if (!unit?.type || !propertyTypes.includes(unit.type)) {
      throw new BadRequestException('This package is not offered for your property type');
    }
  }

  private async assertOwner(
    communityId: string,
    residentId: string | null,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.permissions.includes(PERMISSIONS.PACKAGE_MANAGE)) return;
    const mine = await myResidentIds(this.prisma, actor, communityId);
    if (!residentId || !mine.includes(residentId)) {
      throw new ForbiddenException('You can only act on your own package purchases');
    }
  }

  private async residentScope(
    communityId: string,
    requestedResidentId: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<Prisma.ServicePackagePurchaseWhereInput> {
    if (actor.permissions.includes(PERMISSIONS.PACKAGE_MANAGE)) {
      return requestedResidentId ? { residentId: requestedResidentId } : {};
    }
    const mine = await myResidentIds(this.prisma, actor, communityId);
    return { residentId: { in: mine.length ? mine : ['__none__'] } };
  }
}
