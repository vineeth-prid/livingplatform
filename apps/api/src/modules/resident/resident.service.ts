import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { UserLinkService } from '../people/user-link.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  AssignUnitDto,
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
    private readonly events: DomainEventsService,
  ) {}

  async create(communityId: string, dto: CreateResidentDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(communityId);
    if (dto.userId) {
      await this.userLink.assertLinkable(dto.userId, community.tenantId);
    }

    const resident = await this.prisma.resident.create({
      data: {
        communityId,
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
        status: dto.status ?? 'ACTIVE',
        notes: dto.notes,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.ResidentCreated,
      ...this.events.from(actor, communityId),
      entityId: resident.id,
      data: { residentCode: resident.residentCode },
    });
    return this.present(resident);
  }

  async findMany(communityId: string, query: QueryResidentDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.ResidentWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.unitId || query.blockId || query.floorId
        ? {
            unitAssignment: {
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

    const data = {
      unitId: dto.unitId,
      role: dto.role ?? 'PRIMARY',
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
