import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { OwnershipStatus, Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResidentService } from '../resident/resident.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  AddUnitOwnerDto, EndUnitOwnerDto, TransferOwnershipDto, UpdateUnitOwnerDto,
} from './dto/ownership.dto';
import { OwnershipService } from './ownership.service';

/**
 * Admin management of unit ownership.
 *
 * Deliberately thin: the PEOPLE side is `ResidentService` (which already
 * provisions a login, syncs the phone username and publishes the events the
 * Notification Engine listens to) and the AUTHORITY on who owes what is
 * `OwnershipService`. This class only records the relationship between the two
 * and writes the audit trail.
 */
@Injectable()
export class UnitOwnershipService {
  private readonly logger = new Logger(UnitOwnershipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly ownership: OwnershipService,
    private readonly residents: ResidentService,
    private readonly audit: AuditService,
  ) {}

  /** Owners on record for a unit, with their account status for the admin UI. */
  async list(communityId: string, unitId: string) {
    await this.assertUnit(communityId, unitId);
    const rows = await this.ownership.ownersOfUnit(unitId);
    return rows.map((row) => ({
      id: row.id,
      residentId: row.residentId,
      isPrimary: row.isPrimary,
      sharePercent: row.sharePercent === null ? null : Number(row.sharePercent),
      startDate: row.startDate,
      firstName: row.resident.firstName,
      lastName: row.resident.lastName,
      mobile: row.resident.mobile,
      email: row.resident.email,
      residentStatus: row.resident.status,
      /*
        Ownership status and ACCOUNT status are different questions, and the
        admin needs both: someone can own a flat for years without ever opening
        the app. NOT_REGISTERED means exactly that — not a problem, just a fact.
      */
      accountStatus: row.resident.user ? row.resident.user.status : 'NOT_REGISTERED',
    }));
  }

  /**
   * Record an owner. Either links an existing resident or creates the person
   * (with a login) through the ordinary resident flow — never a second account
   * for someone the community already knows.
   */
  async add(communityId: string, unitId: string, dto: AddUnitOwnerDto, actor: AuthenticatedUser) {
    await this.assertUnit(communityId, unitId);

    const residentId = dto.residentId
      ? await this.assertResidentInCommunity(dto.residentId, communityId)
      : await this.createOwnerResident(communityId, dto, actor);

    const existing = await this.prisma.unitOwnership.findUnique({
      where: { unitId_residentId: { unitId, residentId } },
      select: { id: true, status: true, deletedAt: true },
    });
    if (existing && existing.status === OwnershipStatus.ACTIVE && !existing.deletedAt) {
      throw new ConflictException('That person is already recorded as an owner of this unit');
    }

    // The first owner on a unit is its primary unless told otherwise; a later
    // one only takes over when explicitly asked, and then the old primary steps
    // down — a unit has exactly one person the association addresses.
    const current = await this.ownership.ownersOfUnit(unitId);
    const isPrimary = dto.isPrimary ?? current.length === 0;
    if (isPrimary && current.length > 0) {
      await this.prisma.unitOwnership.updateMany({
        where: { unitId, deletedAt: null, status: OwnershipStatus.ACTIVE },
        data: { isPrimary: false, updatedById: actor.id },
      });
    }

    const data = {
      isPrimary,
      sharePercent: dto.sharePercent,
      startDate: dto.startDate ?? new Date(),
      endDate: null,
      status: OwnershipStatus.ACTIVE,
      notes: dto.notes,
      deletedAt: null,
      updatedById: actor.id,
    };
    const row = await this.prisma.unitOwnership.upsert({
      where: { unitId_residentId: { unitId, residentId } },
      create: { communityId, unitId, residentId, createdById: actor.id, ...data },
      update: data,
    });

    await this.record(actor, communityId, 'ownership.owner_added', row.id, {
      unitId, residentId, isPrimary,
    });
    return row;
  }

  async update(
    communityId: string,
    unitId: string,
    residentId: string,
    dto: UpdateUnitOwnerDto,
    actor: AuthenticatedUser,
  ) {
    await this.assertUnit(communityId, unitId);
    const row = await this.loadOwnership(unitId, residentId);

    if (dto.isPrimary) {
      await this.prisma.unitOwnership.updateMany({
        where: { unitId, deletedAt: null, status: OwnershipStatus.ACTIVE, id: { not: row.id } },
        data: { isPrimary: false, updatedById: actor.id },
      });
    }
    const updated = await this.prisma.unitOwnership.update({
      where: { id: row.id },
      data: {
        isPrimary: dto.isPrimary,
        sharePercent: dto.sharePercent,
        notes: dto.notes,
        updatedById: actor.id,
      },
    });
    await this.record(actor, communityId, 'ownership.owner_updated', row.id, { unitId, residentId });
    return updated;
  }

  /**
   * End an ownership. Never a hard delete: an invoice raised while this person
   * owned the flat has to stay explainable, and a sale is history, not a typo.
   */
  async end(
    communityId: string,
    unitId: string,
    residentId: string,
    dto: EndUnitOwnerDto,
    actor: AuthenticatedUser,
  ) {
    await this.assertUnit(communityId, unitId);
    const row = await this.loadOwnership(unitId, residentId);
    const updated = await this.prisma.unitOwnership.update({
      where: { id: row.id },
      data: {
        status: OwnershipStatus.TRANSFERRED,
        endDate: dto.endDate ?? new Date(),
        isPrimary: false,
        notes: dto.reason ?? row.notes,
        updatedById: actor.id,
      },
    });
    await this.record(actor, communityId, 'ownership.owner_removed', row.id, {
      unitId, residentId, reason: dto.reason ?? null,
    });
    return updated;
  }

  /** Hand a unit from its current owners to a new one, in one step. */
  async transfer(
    communityId: string,
    unitId: string,
    dto: TransferOwnershipDto,
    actor: AuthenticatedUser,
  ) {
    await this.assertUnit(communityId, unitId);
    const toResidentId = await this.assertResidentInCommunity(dto.toResidentId, communityId);
    const effectiveFrom = dto.effectiveFrom ?? new Date();

    const current = await this.ownership.ownersOfUnit(unitId);
    for (const row of current) {
      if (row.residentId === toResidentId) continue;
      await this.prisma.unitOwnership.update({
        where: { id: row.id },
        data: {
          status: OwnershipStatus.TRANSFERRED,
          endDate: effectiveFrom,
          isPrimary: false,
          updatedById: actor.id,
        },
      });
    }
    const incoming = await this.add(
      communityId,
      unitId,
      { residentId: toResidentId, isPrimary: true, startDate: effectiveFrom, notes: dto.notes },
      actor,
    );
    await this.record(actor, communityId, 'ownership.transferred', unitId, {
      unitId, toResidentId, from: current.map((c) => c.residentId),
    });
    return incoming;
  }

  /**
   * Units with nobody on record as the owner — the migration's report.
   *
   * The backfill refuses to infer ownership from occupancy, so this is the list
   * an admin works through. Occupancy is shown alongside because it is usually
   * the answer ("the person living there IS the owner") without ever being
   * assumed to be.
   */
  async gaps(communityId: string, limit = 200) {
    await this.access.assert(communityId);
    const units = await this.prisma.unit.findMany({
      where: {
        communityId,
        deletedAt: null,
        ownerships: { none: { deletedAt: null, status: OwnershipStatus.ACTIVE } },
      },
      take: limit,
      orderBy: { unitNumber: 'asc' },
      select: {
        id: true, unitNumber: true, ownership: true, ownerName: true, ownerPhone: true,
        residentUnits: {
          where: { status: 'ACTIVE', resident: { deletedAt: null } },
          select: {
            role: true,
            resident: { select: { id: true, firstName: true, lastName: true, mobile: true } },
          },
        },
      },
    });

    return {
      total: units.length,
      limit,
      units: units.map((u) => ({
        unitId: u.id,
        unitNumber: u.unitNumber,
        declaredOwnership: u.ownership,
        ownerNameOnUnit: u.ownerName,
        ownerPhoneOnUnit: u.ownerPhone,
        occupants: u.residentUnits.map((ru) => ({
          residentId: ru.resident.id,
          name: `${ru.resident.firstName} ${ru.resident.lastName}`.trim(),
          mobile: ru.resident.mobile,
          role: ru.role,
        })),
        // Only ever a hint for the admin to confirm. Never applied automatically:
        // a unit whose only occupant is a TENANT suggests nobody at all.
        suggestion:
          u.residentUnits.find((ru) => ru.role === 'OWNER')?.resident.id ??
          (u.residentUnits.some((ru) => ru.role === 'TENANT')
            ? null
            : u.residentUnits[0]?.resident.id ?? null),
      })),
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async createOwnerResident(
    communityId: string,
    dto: AddUnitOwnerDto,
    actor: AuthenticatedUser,
  ): Promise<string> {
    if (!dto.firstName || !dto.mobile) {
      throw new BadRequestException(
        'Give an existing residentId, or the owner’s first name and mobile number',
      );
    }
    // Someone the community already knows (an owner of another flat, or the
    // occupier themselves) is linked, never given a second record and login.
    const known = await this.residents.findByMobile(communityId, dto.mobile);
    if (known) return known.id;
    /*
      Created WITHOUT a unit assignment on purpose.

      An owner is not automatically an occupant — most are not — and assigning
      them to the flat would collide with the tenant living there and rewrite
      who the gate asks about a visitor. Ownership is recorded separately, which
      is the whole point of the new relation.
    */
    const resident = await this.residents.create(
      communityId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName?.trim() || dto.firstName,
        mobile: dto.mobile,
        email: dto.email,
      } as never,
      actor,
    );
    return (resident as { id: string }).id;
  }

  private async assertUnit(communityId: string, unitId: string) {
    await this.access.assert(communityId);
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!unit) throw new NotFoundException('Unit not found in this community');
    return unit;
  }

  private async assertResidentInCommunity(residentId: string, communityId: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id: residentId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!resident) throw new BadRequestException('That resident does not belong to this community');
    return resident.id;
  }

  private async loadOwnership(unitId: string, residentId: string) {
    const row = await this.prisma.unitOwnership.findFirst({
      where: { unitId, residentId, deletedAt: null, status: OwnershipStatus.ACTIVE },
    });
    if (!row) throw new NotFoundException('That person is not an owner of this unit');
    return row;
  }

  /** Ownership changes move money, so every one of them is on the record. */
  private async record(
    actor: AuthenticatedUser,
    communityId: string,
    action: string,
    resourceId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    await this.audit
      .record({
        action,
        resource: 'unit-ownerships',
        resourceId,
        actorId: actor.id,
        actorEmail: actor.email,
        tenantId: actor.tenantId ?? undefined,
        communityId,
        metadata,
      })
      .catch((err: Error) => this.logger.warn(`Ownership audit failed: ${err.message}`));
  }
}
