import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateFloorDto,
  QueryFloorDto,
  UpdateFloorDto,
} from './dto/floor.dto';

const SORTABLE = ['level', 'sortOrder', 'createdAt', 'status'] as const;

/**
 * Floors always hang off a Block. The parent block is loaded first — its
 * communityId is the tenant-access anchor, and the floor inherits it (keeping
 * the denormalized communityId consistent with its ancestor).
 */
@Injectable()
export class FloorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async create(dto: CreateFloorDto, actor: AuthenticatedUser) {
    const block = await this.prisma.block.findFirst({
      where: { id: dto.blockId, deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!block) throw new NotFoundException('Block not found');
    await this.access.assert(block.communityId);

    const floor = await this.prisma.floor.create({
      data: {
        communityId: block.communityId,
        blockId: block.id,
        level: dto.level,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.FloorCreated,
      ...this.events.from(actor, block.communityId),
      entityId: floor.id,
      data: { name: floor.name ?? `Level ${floor.level}` },
    });
    return floor;
  }

  async findMany(communityId: string, query: QueryFloorDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.FloorWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.blockId ? { blockId: query.blockId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.floor.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'level'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.floor.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const floor = await this.prisma.floor.findFirst({ where: { id, deletedAt: null } });
    if (!floor) throw new NotFoundException('Floor not found');
    await this.access.assert(floor.communityId);
    return floor;
  }

  async update(id: string, dto: UpdateFloorDto, actor: AuthenticatedUser) {
    await this.findOne(id);
    return this.prisma.floor.update({
      where: { id },
      data: {
        level: dto.level,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        status: dto.status,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id);
    await this.prisma.floor.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }
}
