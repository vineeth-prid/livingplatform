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
  CreateBlockDto,
  QueryBlockDto,
  UpdateBlockDto,
} from './dto/block.dto';

const SORTABLE = ['name', 'code', 'sortOrder', 'createdAt', 'status', 'type'] as const;

@Injectable()
export class BlockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async create(communityId: string, dto: CreateBlockDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    if (dto.phaseId) await this.assertPhaseInCommunity(dto.phaseId, communityId);

    const block = await this.prisma.block.create({
      data: {
        communityId,
        phaseId: dto.phaseId ?? null,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        totalFloors: dto.totalFloors,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.BlockCreated,
      ...this.events.from(actor, communityId),
      entityId: block.id,
      data: { name: block.name, code: block.code },
    });
    return block;
  }

  async findMany(communityId: string, query: QueryBlockDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.BlockWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.phaseId ? { phaseId: query.phaseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.block.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'sortOrder'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.block.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const block = await this.prisma.block.findFirst({ where: { id, deletedAt: null } });
    if (!block) throw new NotFoundException('Block not found');
    await this.access.assert(block.communityId);
    return block;
  }

  async update(id: string, dto: UpdateBlockDto, actor: AuthenticatedUser) {
    const block = await this.findOne(id);
    if (dto.phaseId) await this.assertPhaseInCommunity(dto.phaseId, block.communityId);
    return this.prisma.block.update({
      where: { id },
      data: {
        phaseId: dto.phaseId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        totalFloors: dto.totalFloors,
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
    await this.prisma.block.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  /** A block's phase must belong to the same community (cross-community guard). */
  private async assertPhaseInCommunity(phaseId: string, communityId: string) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!phase) {
      throw new BadRequestException('phaseId does not belong to this community');
    }
  }
}
