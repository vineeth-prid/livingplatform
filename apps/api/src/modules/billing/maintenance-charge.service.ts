import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCycle, ChargeCalculationMethod, Prisma, type MaintenanceCharge } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { ALL_UNIT_TYPES, areaInSqft, chargeInForce, perSqftAmount } from './billing.math';
import type {
  QueryMaintenanceChargeDto,
  UpsertMaintenanceChargeDto,
} from './dto/billing.dto';

const SORTABLE = ['effectiveFrom', 'propertyType', 'monthlyAmount', 'createdAt'] as const;

/** API shape — Decimal columns become plain numbers so clients never see strings. */
export interface MaintenanceChargeView {
  id: string;
  communityId: string;
  propertyType: string;
  calculationMethod: ChargeCalculationMethod;
  /** ₹ per sq. ft. per month (PER_SQFT only). */
  ratePerSqft: number | null;
  monthlyAmount: number;
  quarterlyAmount: number | null;
  yearlyAmount: number | null;
  lateFeeAmount: number;
  lateFeePercent: number;
  gracePeriodDays: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  notes: string | null;
  /** True when this is the row currently in force for its property type. */
  current: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Maintenance rate cards (Feature 3). Charges are configured per property type
 * — the community's own `Unit.type` values, so nothing is hardcoded and a
 * community that only has villas never sees a "3 BHK" row.
 *
 * A rate revision is a NEW row with a later `effectiveFrom`, never an edit of
 * history: invoices already issued keep pointing at the rate that produced
 * them. `chargeInForce` picks the applicable row per period.
 */
@Injectable()
export class MaintenanceChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async findMany(
    communityId: string,
    query: QueryMaintenanceChargeDto,
  ): Promise<Paginated<MaintenanceChargeView>> {
    await this.access.assert(communityId);
    const where: Prisma.MaintenanceChargeWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.propertyType ? { propertyType: query.propertyType } : {}),
      ...(query.search
        ? { propertyType: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.maintenanceCharge.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'effectiveFrom'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.maintenanceCharge.count({ where }),
    ]);

    const currentIds = await this.currentChargeIds(communityId);
    const items = rows
      .map((r) => toView(r, currentIds.has(r.id)))
      .filter((r) => (query.currentOnly ? r.current : true));
    return paginate(items, total, query);
  }

  /** The rate card in force today, one row per property type. */
  async current(communityId: string): Promise<MaintenanceChargeView[]> {
    await this.access.assert(communityId);
    const rows = await this.prisma.maintenanceCharge.findMany({
      where: { communityId, deletedAt: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    const now = new Date();
    const byType = new Map<string, MaintenanceCharge>();
    for (const type of new Set(rows.map((r) => r.propertyType))) {
      const inForce = chargeInForce(
        rows.filter((r) => r.propertyType === type),
        now,
      );
      if (inForce) byType.set(type, inForce);
    }
    return [...byType.values()]
      .sort((a, b) => a.propertyType.localeCompare(b.propertyType))
      .map((r) => toView(r, true));
  }

  /**
   * Property types this community actually uses, so the config UI offers real
   * options instead of a hardcoded 1/2/3/4 BHK list. Types already priced are
   * included even if every such unit was since removed.
   */
  async propertyTypes(communityId: string): Promise<Array<{ type: string; unitCount: number; configured: boolean }>> {
    await this.access.assert(communityId);
    const [units, charges] = await Promise.all([
      this.prisma.unit.groupBy({
        by: ['type'],
        where: { communityId, deletedAt: null, type: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.maintenanceCharge.findMany({
        where: { communityId, deletedAt: null },
        select: { propertyType: true },
        distinct: ['propertyType'],
      }),
    ]);
    const configured = new Set(charges.map((c) => c.propertyType));
    const seen = new Map<string, number>();
    for (const u of units) if (u.type) seen.set(u.type, u._count._all);
    for (const t of configured) if (!seen.has(t)) seen.set(t, 0);
    return [...seen.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, unitCount]) => ({ type, unitCount, configured: configured.has(type) }));
  }

  /**
   * What a per-sq-ft rate would bill each unit per month, before it is saved —
   * real amounts from real areas, plus the units that have no area recorded and
   * would therefore be left unbilled.
   */
  async previewPerSqft(communityId: string, ratePerSqft: number, propertyType?: string) {
    await this.access.assert(communityId);
    const units = await this.prisma.unit.findMany({
      where: {
        communityId,
        deletedAt: null,
        ...(propertyType && propertyType !== ALL_UNIT_TYPES ? { type: propertyType } : {}),
      },
      select: { id: true, unitNumber: true, type: true, builtUpArea: true, areaUnit: true },
      orderBy: { unitNumber: 'asc' },
    });
    const rows = units.map((u) => {
      const area = areaInSqft(u.builtUpArea, u.areaUnit);
      return {
        unitId: u.id,
        unitNumber: u.unitNumber,
        type: u.type,
        areaSqft: area ? area.toNumber() : null,
        monthlyAmount: area ? perSqftAmount(area, ratePerSqft, BillingCycle.MONTHLY) : null,
      };
    });
    const billable = rows.filter((r) => r.monthlyAmount !== null);
    return {
      ratePerSqft,
      unitCount: rows.length,
      billableCount: billable.length,
      totalMonthly: billable
        .reduce((sum, r) => sum.plus(r.monthlyAmount!), new Prisma.Decimal(0))
        .toDecimalPlaces(2)
        .toNumber(),
      missingArea: rows.filter((r) => r.areaSqft === null).map((r) => r.unitNumber),
      sample: billable.slice(0, 10),
    };
  }

  async create(
    communityId: string,
    dto: UpsertMaintenanceChargeDto,
    actor: AuthenticatedUser,
  ): Promise<MaintenanceChargeView> {
    await this.access.assert(communityId);
    const effectiveFrom = startOfDay(new Date(dto.effectiveFrom));
    const effectiveTo = dto.effectiveTo ? endOfDay(new Date(dto.effectiveTo)) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('effectiveTo cannot be before effectiveFrom');
    }

    const existing = await this.prisma.maintenanceCharge.findFirst({
      where: { communityId, propertyType: dto.propertyType, effectiveFrom, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `A ${dto.propertyType} rate already starts on this date — edit it instead of adding a duplicate`,
      );
    }

    const row = await this.prisma.maintenanceCharge.create({
      data: {
        communityId,
        propertyType: dto.propertyType,
        ...pricingFor(dto),
        lateFeeAmount: dto.lateFeeAmount ?? 0,
        lateFeePercent: dto.lateFeePercent ?? 0,
        gracePeriodDays: dto.gracePeriodDays ?? 0,
        effectiveFrom,
        effectiveTo,
        notes: dto.notes,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.publish(actor, communityId, row);
    return toView(row, (await this.currentChargeIds(communityId)).has(row.id));
  }

  async update(
    communityId: string,
    id: string,
    dto: Partial<UpsertMaintenanceChargeDto>,
    actor: AuthenticatedUser,
  ): Promise<MaintenanceChargeView> {
    await this.access.assert(communityId);
    await this.assertOwned(communityId, id);
    const current = await this.prisma.maintenanceCharge.findUniqueOrThrow({ where: { id } });
    const method = dto.calculationMethod ?? current.calculationMethod;
    if (method !== current.calculationMethod) {
      // Bills already raised on this rate keep their amounts either way, but a
      // rate that changes method in place no longer explains them. A change of
      // method is a new rate card from a new date.
      const billed = await this.prisma.maintenanceInvoice.count({ where: { chargeId: id } });
      if (billed > 0) {
        throw new BadRequestException(
          `This rate has already billed ${billed} invoice${billed === 1 ? '' : 's'} — add a new rate with a later "effective from" date to change how it is calculated`,
        );
      }
    }
    // A FIXED rate that stays FIXED is edited exactly as before.
    const pricing =
      method === ChargeCalculationMethod.FIXED && current.calculationMethod === ChargeCalculationMethod.FIXED
        ? { monthlyAmount: dto.monthlyAmount, quarterlyAmount: dto.quarterlyAmount, yearlyAmount: dto.yearlyAmount }
        : pricingFor({
            ...dto,
            calculationMethod: method,
            ratePerSqft: dto.ratePerSqft ?? (current.ratePerSqft === null ? undefined : Number(current.ratePerSqft)),
          });
    const row = await this.prisma.maintenanceCharge.update({
      where: { id },
      data: {
        propertyType: dto.propertyType,
        ...pricing,
        lateFeeAmount: dto.lateFeeAmount,
        lateFeePercent: dto.lateFeePercent,
        gracePeriodDays: dto.gracePeriodDays,
        ...(dto.effectiveFrom ? { effectiveFrom: startOfDay(new Date(dto.effectiveFrom)) } : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: dto.effectiveTo ? endOfDay(new Date(dto.effectiveTo)) : null }
          : {}),
        notes: dto.notes,
        updatedById: actor.id,
      },
    });
    this.publish(actor, communityId, row);
    return toView(row, (await this.currentChargeIds(communityId)).has(row.id));
  }

  async remove(
    communityId: string,
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ id: string; deleted: boolean }> {
    await this.access.assert(communityId);
    await this.assertOwned(communityId, id);
    await this.prisma.maintenanceCharge.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  private async assertOwned(communityId: string, id: string): Promise<void> {
    const row = await this.prisma.maintenanceCharge.findFirst({
      where: { id, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Maintenance charge not found');
  }

  /** Ids of the rows currently in force, one per property type. */
  private async currentChargeIds(communityId: string): Promise<Set<string>> {
    const rows = await this.prisma.maintenanceCharge.findMany({
      where: { communityId, deletedAt: null },
      select: { id: true, propertyType: true, effectiveFrom: true, effectiveTo: true },
    });
    const now = new Date();
    const ids = new Set<string>();
    for (const type of new Set(rows.map((r) => r.propertyType))) {
      const inForce = chargeInForce(
        rows.filter((r) => r.propertyType === type),
        now,
      );
      if (inForce) ids.add(inForce.id);
    }
    return ids;
  }

  private publish(actor: AuthenticatedUser, communityId: string, row: MaintenanceCharge): void {
    this.events.publish({
      name: DomainEventName.MaintenanceChargeUpdated,
      ...this.events.from(actor, communityId),
      entityId: row.id,
      data: { propertyType: row.propertyType, amount: Number(row.monthlyAmount) },
    });
  }
}

function toView(row: MaintenanceCharge, current: boolean): MaintenanceChargeView {
  return {
    id: row.id,
    communityId: row.communityId,
    propertyType: row.propertyType,
    calculationMethod: row.calculationMethod,
    ratePerSqft: row.ratePerSqft === null ? null : Number(row.ratePerSqft),
    monthlyAmount: Number(row.monthlyAmount),
    quarterlyAmount: row.quarterlyAmount === null ? null : Number(row.quarterlyAmount),
    yearlyAmount: row.yearlyAmount === null ? null : Number(row.yearlyAmount),
    lateFeeAmount: Number(row.lateFeeAmount),
    lateFeePercent: row.lateFeePercent,
    gracePeriodDays: row.gracePeriodDays,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    notes: row.notes,
    current,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/**
 * The price columns for a new (or re-priced) rate card. FIXED fills the original
 * amount fields; PER_SQFT stores the rate and zeroes the amounts, which only
 * FIXED billing reads.
 */
function pricingFor(dto: Partial<UpsertMaintenanceChargeDto>) {
  if (dto.calculationMethod === ChargeCalculationMethod.PER_SQFT) {
    if (!dto.ratePerSqft || dto.ratePerSqft <= 0) {
      throw new BadRequestException('A per-sq-ft rate needs a rate per sq. ft. greater than 0');
    }
    return {
      calculationMethod: ChargeCalculationMethod.PER_SQFT,
      ratePerSqft: new Prisma.Decimal(dto.ratePerSqft),
      monthlyAmount: 0,
      quarterlyAmount: null,
      yearlyAmount: null,
    };
  }
  if (dto.monthlyAmount === undefined) throw new BadRequestException('A fixed rate needs a monthly amount');
  return {
    calculationMethod: ChargeCalculationMethod.FIXED,
    ratePerSqft: null,
    monthlyAmount: dto.monthlyAmount,
    quarterlyAmount: dto.quarterlyAmount ?? null,
    yearlyAmount: dto.yearlyAmount ?? null,
  };
}
