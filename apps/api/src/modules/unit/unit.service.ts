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
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  BulkUnitUploadDto,
  CreateUnitDto,
  QueryUnitDto,
  UpdateUnitDto,
} from './dto/unit.dto';

const SORTABLE = ['unitNumber', 'createdAt', 'status', 'type'] as const;

@Injectable()
export class UnitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async create(communityId: string, dto: CreateUnitDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    await this.assertAncestors(communityId, dto);

    const unit = await this.prisma.unit.create({
      data: {
        communityId,
        phaseId: dto.phaseId ?? null,
        blockId: dto.blockId ?? null,
        floorId: dto.floorId ?? null,
        unitNumber: dto.unitNumber,
        type: dto.type,
        carpetArea: dto.carpetArea,
        builtUpArea: dto.builtUpArea,
        areaUnit: dto.areaUnit ?? 'sqft',
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        parkingSlots: dto.parkingSlots ?? 0,
        status: dto.status ?? 'VACANT',
        ownership: dto.ownership ?? 'UNKNOWN',
        ownerName: dto.ownerName,
        ownerPhone: dto.ownerPhone,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.UnitCreated,
      ...this.events.from(actor, communityId),
      entityId: unit.id,
      data: { unitNumber: unit.unitNumber },
    });
    return unit;
  }

  /**
   * Bulk upload units from parsed rows. Blocks (by name/code) and floors (by
   * level within a block) are resolved and created on demand. Rows are processed
   * individually so one bad row (e.g. duplicate unitNumber) doesn't sink the batch.
   */
  async bulkCreate(communityId: string, dto: BulkUnitUploadDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(communityId);
    const blockCache = new Map<string, string>(); // key: lower name/code → blockId
    const floorCache = new Map<string, string>(); // key: `${blockId}:${level}` → floorId
    let created = 0;
    const errors: { row: number; unitNumber: string; error: string }[] = [];

    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i]!;
      try {
        let blockId: string | null = null;
        if (row.block) {
          blockId = await this.resolveBlock(communityId, community.tenantId, row.block, blockCache, actor);
        }
        let floorId: string | null = null;
        if (blockId && row.floorLevel != null) {
          floorId = await this.resolveFloor(communityId, blockId, row.floorLevel, floorCache, actor);
        }
        await this.prisma.unit.create({
          data: {
            communityId,
            blockId,
            floorId,
            unitNumber: row.unitNumber,
            type: row.type,
            bedrooms: row.bedrooms,
            bathrooms: row.bathrooms,
            parkingSlots: row.parkingSlots ?? 0,
            builtUpArea: row.builtUpArea,
            ownership: row.ownership ?? 'UNKNOWN',
            ownerName: row.ownerName,
            ownerPhone: row.ownerPhone,
            createdById: actor.id,
            updatedById: actor.id,
          },
        });
        created++;
      } catch (err) {
        errors.push({
          row: i + 1,
          unitNumber: row.unitNumber,
          error: err instanceof Error ? err.message : 'Failed',
        });
      }
    }
    return { created, failed: errors.length, errors };
  }

  private async resolveBlock(
    communityId: string,
    tenantId: string,
    ref: string,
    cache: Map<string, string>,
    actor: AuthenticatedUser,
  ): Promise<string> {
    void tenantId;
    const key = ref.trim().toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;
    const found = await this.prisma.block.findFirst({
      where: {
        communityId,
        deletedAt: null,
        OR: [
          { name: { equals: ref.trim(), mode: 'insensitive' } },
          { code: { equals: ref.trim(), mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    const id = found?.id ?? (await this.prisma.block.create({
      data: {
        communityId, name: ref.trim(), code: ref.trim().toUpperCase().slice(0, 12),
        type: 'TOWER', createdById: actor.id, updatedById: actor.id,
      },
      select: { id: true },
    })).id;
    cache.set(key, id);
    return id;
  }

  private async resolveFloor(
    communityId: string,
    blockId: string,
    level: number,
    cache: Map<string, string>,
    actor: AuthenticatedUser,
  ): Promise<string> {
    const key = `${blockId}:${level}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const found = await this.prisma.floor.findFirst({
      where: { blockId, level, deletedAt: null },
      select: { id: true },
    });
    const id = found?.id ?? (await this.prisma.floor.create({
      data: { communityId, blockId, level, createdById: actor.id, updatedById: actor.id },
      select: { id: true },
    })).id;
    cache.set(key, id);
    return id;
  }

  async findMany(communityId: string, query: QueryUnitDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.UnitWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownership ? { ownership: query.ownership } : {}),
      ...(query.blockId ? { blockId: query.blockId } : {}),
      ...(query.floorId ? { floorId: query.floorId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? { unitNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'unitNumber'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.unit.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, deletedAt: null },
      include: {
        block: { select: { id: true, name: true, code: true } },
        floor: { select: { id: true, level: true, name: true } },
        phase: { select: { id: true, name: true, code: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    await this.access.assert(unit.communityId);
    return unit;
  }

  async update(id: string, dto: UpdateUnitDto, actor: AuthenticatedUser) {
    const unit = await this.findOne(id);
    await this.assertAncestors(unit.communityId, dto);
    return this.prisma.unit.update({
      where: { id },
      data: {
        phaseId: dto.phaseId,
        blockId: dto.blockId,
        floorId: dto.floorId,
        unitNumber: dto.unitNumber,
        type: dto.type,
        carpetArea: dto.carpetArea,
        builtUpArea: dto.builtUpArea,
        areaUnit: dto.areaUnit,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        parkingSlots: dto.parkingSlots,
        status: dto.status,
        ownership: dto.ownership,
        ownerName: dto.ownerName,
        ownerPhone: dto.ownerPhone,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id);
    await this.prisma.unit.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  /** Any provided phase/block/floor must belong to the same community. */
  private async assertAncestors(
    communityId: string,
    dto: CreateUnitDto | UpdateUnitDto,
  ) {
    const checks: Array<Promise<void>> = [];
    if (dto.phaseId) {
      checks.push(
        this.ensure(
          this.prisma.phase.count({
            where: { id: dto.phaseId, communityId, deletedAt: null },
          }),
          'phaseId',
        ),
      );
    }
    if (dto.blockId) {
      checks.push(
        this.ensure(
          this.prisma.block.count({
            where: { id: dto.blockId, communityId, deletedAt: null },
          }),
          'blockId',
        ),
      );
    }
    if (dto.floorId) {
      checks.push(
        this.ensure(
          this.prisma.floor.count({
            where: { id: dto.floorId, communityId, deletedAt: null },
          }),
          'floorId',
        ),
      );
    }
    await Promise.all(checks);
  }

  private async ensure(countPromise: Promise<number>, field: string) {
    if ((await countPromise) === 0) {
      throw new BadRequestException(`${field} does not belong to this community`);
    }
  }
}
