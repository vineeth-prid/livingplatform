import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { AccountProvisioningService, normalizePhone } from '../people/account-provisioning.service';
import { UserLinkService } from '../people/user-link.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  AssignUnitDto,
  BulkResidentUploadDto,
  CreateFamilyMemberDto,
  CreateResidentDto,
  QueryResidentDto,
  UpdateResidentDto,
} from './dto/resident.dto';

const SORTABLE = ['firstName', 'lastName', 'residentCode', 'createdAt', 'status'] as const;

const UNIT_ASSIGNMENT_INCLUDE = {
  unitAssignment: {
    include: {
      unit: {
        select: { id: true, unitNumber: true, blockId: true, floorId: true },
      },
    },
  },
} satisfies Prisma.ResidentInclude;

@Injectable()
export class ResidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly userLink: UserLinkService,
    private readonly accounts: AccountProvisioningService,
    private readonly events: DomainEventsService,
  ) {}

  async create(communityId: string, dto: CreateResidentDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(communityId);
    if (dto.userId) {
      await this.userLink.assertLinkable(dto.userId, community.tenantId);
    }

    // Check the unit BEFORE anything is written. This used to run at the end,
    // via assignUnit, by which point the login account and the resident row were
    // already committed — so "this unit is already occupied" was returned to the
    // admin while the resident appeared in the list anyway, unattached and
    // duplicated on the next attempt. Nothing here is transactional across the
    // account provisioning, so the only reliable fix is to fail before writing.
    if (dto.unitId) {
      await this.assertUnitAssignable(communityId, dto.unitId, dto.occupiedBy);
    }
    await this.assertMobileUnused(communityId, dto.mobile);

    // Login account: username = mobile, common one-time password. Owners with
    // multiple flats reuse their existing account (userId comes back null).
    const userId = dto.userId ?? (await this.accounts.provisionLogin({
      kind: 'resident',
      tenantId: community.tenantId,
      communityId,
      phone: dto.mobile,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      actorId: actor.id,
    }));

    const residentCode = dto.residentCode ?? (await this.nextResidentCode(communityId));

    const resident = await this.prisma.resident.create({
      data: {
        communityId,
        userId,
        residentCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        mobile: dto.mobile,
        email: dto.email,
        photoKey: dto.photoKey,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth,
        occupation: dto.occupation,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        emergencyContactRelationship: dto.emergencyContactRelationship,
        moveInDate: dto.moveInDate,
        status: dto.status ?? 'ACTIVE',
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });

    // Optional unit mapping on create — "Occupied By" becomes the assignment role.
    if (dto.unitId) {
      await this.assignUnit(resident.id, { unitId: dto.unitId, role: dto.occupiedBy }, actor);
    }

    this.events.publish({
      name: DomainEventName.ResidentCreated,
      ...this.events.from(actor, communityId),
      entityId: resident.id,
      data: { residentCode: resident.residentCode },
    });
    return this.findOne(resident.id);
  }

  /** Bulk upload residents; unit mapped by unit number. Row-isolated. */
  async bulkCreate(communityId: string, dto: BulkResidentUploadDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    let created = 0;
    const errors: { row: number; mobile: string; error: string }[] = [];
    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i]!;
      try {
        let unitId: string | undefined;
        if (row.unit) {
          const unit = await this.prisma.unit.findFirst({
            where: { communityId, unitNumber: { equals: row.unit.trim(), mode: 'insensitive' }, deletedAt: null },
            select: { id: true },
          });
          if (!unit) throw new Error(`Unit "${row.unit}" not found`);
          unitId = unit.id;
        }
        await this.create(communityId, {
          firstName: row.firstName, lastName: row.lastName, mobile: row.mobile,
          email: row.email, occupiedBy: row.occupiedBy, unitId,
        }, actor);
        created++;
      } catch (err) {
        errors.push({ row: i + 1, mobile: row.mobile, error: err instanceof Error ? err.message : 'Failed' });
      }
    }
    return { created, failed: errors.length, errors };
  }

  /** Sequential per-community code: R-000001, R-000002, … (gaps are fine). */
  private async nextResidentCode(communityId: string): Promise<string> {
    const count = await this.prisma.resident.count({ where: { communityId } });
    return `R-${String(count + 1).padStart(6, '0')}`;
  }

  async findMany(communityId: string, query: QueryResidentDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.ResidentWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.unitId || query.blockId || query.floorId || query.role
        ? {
            unitAssignment: {
              ...(query.role ? { role: query.role } : {}),
              ...(query.unitId ? { unitId: query.unitId } : {}),
              ...(query.blockId || query.floorId
                ? {
                    unit: {
                      ...(query.blockId ? { blockId: query.blockId } : {}),
                      ...(query.floorId ? { floorId: query.floorId } : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(query.search ? this.searchWhere(query.search) : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.resident.findMany({
        where,
        include: UNIT_ASSIGNMENT_INCLUDE,
        orderBy: resolveSort(query, SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.resident.count({ where }),
    ]);
    return paginate(items.map((r) => this.present(r)), total, query);
  }

  /**
   * The caller's OWN resident record(s) plus the rest of their household.
   *
   * Self-service, so it carries no RBAC permission — a plain resident holds no
   * `resident:read` and must still be able to see which unit they live in, who
   * shares it, and (for visitors/bookings) their own residentId. Everything is
   * scoped by `userId = caller`, so there is nothing to leak.
   */
  async findMine(user: AuthenticatedUser) {
    const residents = await this.prisma.resident.findMany({
      where: { userId: user.id, deletedAt: null },
      include: UNIT_ASSIGNMENT_INCLUDE,
    });

    const unitIds = residents
      .map((r) => r.unitAssignment?.unitId)
      .filter((id): id is string => !!id);

    // Household = everyone else assigned to the same unit(s).
    const family = unitIds.length
      ? await this.prisma.resident.findMany({
          where: {
            deletedAt: null,
            id: { notIn: residents.map((r) => r.id) },
            unitAssignment: { unitId: { in: unitIds } },
          },
          include: UNIT_ASSIGNMENT_INCLUDE,
        })
      : [];

    return {
      residents: residents.map((r) => this.present(r)),
      family: family.map((r) => this.present(r)),
    };
  }

  /**
   * Add a household member to the caller's own unit. Reuses `create`, so they
   * get the same phone-as-username login (one-time password, forced change)
   * every other resident gets — that is the whole point of the feature.
   */
  async addFamilyMember(dto: CreateFamilyMemberDto, actor: AuthenticatedUser) {
    const me = await this.myUnitOrThrow(actor);
    return this.create(
      me.communityId,
      {
        firstName: dto.firstName,
        lastName: dto.lastName?.trim() || dto.firstName,
        mobile: dto.mobile,
        email: dto.email,
        unitId: me.unitId,
        // FAMILY_MEMBER, not SECONDARY: the residents register has to be able
        // to tell a household member the resident added themselves from a
        // co-occupant an admin created.
        occupiedBy: 'FAMILY_MEMBER',
      },
      actor,
    );
  }

  /** Remove a household member — only someone sharing the caller's unit. */
  async removeFamilyMember(id: string, actor: AuthenticatedUser) {
    const me = await this.myUnitOrThrow(actor);
    const target = await this.prisma.resident.findFirst({
      where: { id, deletedAt: null },
      include: { unitAssignment: { select: { unitId: true } } },
    });
    if (!target || target.unitAssignment?.unitId !== me.unitId) {
      throw new ForbiddenException('That person is not in your household');
    }
    if (target.userId === actor.id) {
      throw new BadRequestException('You cannot remove yourself from your own unit');
    }
    return this.remove(id, actor);
  }

  /** The caller's own resident row — must exist and be assigned to a unit. */
  private async myUnitOrThrow(actor: AuthenticatedUser) {
    const me = await this.prisma.resident.findFirst({
      where: { userId: actor.id, deletedAt: null, unitAssignment: { isNot: null } },
      include: { unitAssignment: { select: { unitId: true } } },
    });
    if (!me?.unitAssignment) {
      throw new BadRequestException(
        'Your account is not linked to a unit yet — ask management to link it first',
      );
    }
    return { communityId: me.communityId, unitId: me.unitAssignment.unitId };
  }

  async findOne(id: string) {
    const resident = await this.prisma.resident.findFirst({
      where: { id, deletedAt: null },
      include: UNIT_ASSIGNMENT_INCLUDE,
    });
    if (!resident) throw new NotFoundException('Resident not found');
    await this.access.assert(resident.communityId);
    return this.present(resident);
  }

  async update(id: string, dto: UpdateResidentDto, actor: AuthenticatedUser) {
    const existing = await this.findOne(id);
    if (dto.userId) {
      const community = await this.access.assert(existing.communityId);
      await this.userLink.assertLinkable(dto.userId, community.tenantId, {
        kind: 'resident',
        id,
      });
    }
    // The mobile is the login username — move the account before saving, so a
    // clash fails the edit rather than leaving the resident on a number that
    // does not sign in.
    if (dto.mobile) {
      // Same rule as create: an edit must not move this resident onto a number
      // another resident in the community already holds.
      await this.assertMobileUnused(existing.communityId, dto.mobile, id);
      await this.accounts.syncLoginPhone({
        userId: existing.userId,
        oldPhone: existing.mobile,
        newPhone: dto.mobile,
        actorId: actor.id,
      });
    }
    const resident = await this.prisma.resident.update({
      where: { id },
      data: {
        userId: dto.userId,
        residentCode: dto.residentCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        mobile: dto.mobile,
        email: dto.email,
        photoKey: dto.photoKey,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth,
        occupation: dto.occupation,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        emergencyContactRelationship: dto.emergencyContactRelationship,
        moveInDate: dto.moveInDate,
        status: dto.status,
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
      include: UNIT_ASSIGNMENT_INCLUDE,
    });
    return this.present(resident);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id);
    await this.prisma.resident.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  /** Assign (or re-assign) the resident to a unit in their own community. */
  async assignUnit(residentId: string, dto: AssignUnitDto, actor: AuthenticatedUser) {
    const resident = await this.findOne(residentId);
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!unit || unit.communityId !== resident.communityId) {
      throw new BadRequestException('Unit does not belong to this community');
    }

    const role = dto.role ?? 'PRIMARY';
    await this.assertUnitAvailable(dto.unitId, residentId, role);

    const data = {
      unitId: dto.unitId,
      role,
      moveInDate: dto.moveInDate,
      moveOutDate: dto.moveOutDate,
      status: dto.status ?? 'ACTIVE',
      updatedById: actor.id,
    };
    const assignment = await this.prisma.residentUnit.upsert({
      where: { residentId },
      create: { residentId, createdById: actor.id, ...data },
      update: data,
    });
    this.events.publish({
      name: DomainEventName.ResidentAssignedToUnit,
      ...this.events.from(actor, resident.communityId),
      entityId: residentId,
      data: { residentCode: resident.residentCode, unitId: dto.unitId },
    });
    return assignment;
  }

  /**
   * One resident per unit — plus their household.
   *
   * A unit holds exactly ONE occupant record that represents the resident
   * (owner, tenant, primary, co-occupant) and any number of FAMILY_MEMBERs
   * underneath them. Two unrelated residents on one flat is a data-entry
   * mistake, not a scenario: it makes "whose flat is this" unanswerable and
   * sends notifications, gate approvals and maintenance bills to the wrong
   * household.
   *
   * The inverse is untouched: one resident may hold many units, which is how an
   * owner with several flats works. Only the unit side is exclusive.
   */
  /**
   * One mobile number, one resident, per community.
   *
   * The login layer deliberately REUSES an account when the number is already
   * known — one human, one login, across every community they belong to (see
   * account-provisioning.service.ts). That is right for an owner with flats in
   * two societies. It is wrong here: entering an existing number while adding a
   * *different* person in the *same* community produced a second resident record
   * hanging off somebody else's login, and neither record was identifiable
   * afterwards. Cross-community reuse is untouched — this only rejects a
   * duplicate inside one community.
   *
   * Compared on the normalised number, so "+91 98765 43210" and "9876543210"
   * are recognised as the same person rather than slipping past as two.
   */
  private async assertMobileUnused(
    communityId: string,
    mobile: string,
    exceptResidentId?: string,
  ): Promise<void> {
    const normalized = normalizePhone(mobile);
    const residents = await this.prisma.resident.findMany({
      where: {
        communityId,
        deletedAt: null,
        ...(exceptResidentId ? { id: { not: exceptResidentId } } : {}),
      },
      select: { id: true, firstName: true, lastName: true, mobile: true },
    });
    const clash = residents.find((r) => normalizePhone(r.mobile) === normalized);
    if (!clash) return;

    const name = `${clash.firstName} ${clash.lastName}`.trim();
    throw new BadRequestException(
      `${normalized} is already registered to ${name} in this community. ` +
        'Use a different number, or add this person to that household as a family member.',
    );
  }

  /**
   * The same occupancy rule as `assertUnitAvailable`, for a resident that does
   * not exist yet — so create() can refuse before it writes anything. Also
   * checks the unit belongs to the community, which assignUnit does separately.
   */
  private async assertUnitAssignable(
    communityId: string,
    unitId: string,
    role: string | undefined,
  ): Promise<void> {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, deletedAt: null },
      select: { communityId: true },
    });
    if (!unit || unit.communityId !== communityId) {
      throw new BadRequestException('Unit does not belong to this community');
    }
    // '' is not a real resident id; it simply never matches the `not` filter.
    await this.assertUnitAvailable(unitId, '', role ?? 'PRIMARY');
  }

  private async assertUnitAvailable(
    unitId: string,
    residentId: string,
    role: string,
  ): Promise<void> {
    // A family member is added UNDER the existing resident, so they never
    // conflict — the whole point is that a household shares one flat.
    if (role === 'FAMILY_MEMBER') return;

    const occupant = await this.prisma.residentUnit.findFirst({
      where: {
        unitId,
        residentId: { not: residentId },
        role: { not: 'FAMILY_MEMBER' },
        resident: { deletedAt: null },
      },
      select: { resident: { select: { firstName: true, lastName: true } } },
    });
    if (!occupant) return;

    const name = `${occupant.resident.firstName} ${occupant.resident.lastName}`.trim();
    throw new BadRequestException(
      `This unit is already occupied by ${name}. Move them out first, or add this person ` +
        'as a family member of that household.',
    );
  }

  /** Remove the current unit assignment (no history kept). */
  async unassignUnit(residentId: string) {
    await this.findOne(residentId);
    await this.prisma.residentUnit.deleteMany({ where: { residentId } });
    return { residentId, unassigned: true };
  }

  private searchWhere(search: string): Prisma.ResidentWhereInput {
    const contains = { contains: search, mode: 'insensitive' as const };
    return {
      OR: [
        { firstName: contains },
        { lastName: contains },
        { mobile: contains },
        { email: contains },
        { residentCode: contains },
      ],
    };
  }

  private present<T extends { photoKey: string | null }>(resident: T) {
    return { ...resident, photoUrl: this.storage.resolveUrl(resident.photoKey) };
  }
}
