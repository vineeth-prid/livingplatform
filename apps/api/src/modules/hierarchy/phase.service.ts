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
  CreatePhaseDto,
  QueryPhaseDto,
  UpdatePhaseDto,
} from './dto/phase.dto';

const SORTABLE = ['name', 'code', 'sortOrder', 'createdAt', 'status'] as const;

@Injectable()
export class PhaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly events: DomainEventsService,
  ) {}

  async create(communityId: string, dto: CreatePhaseDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const phase = await this.prisma.phase.create({
      data: {
        communityId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.PhaseCreated,
      ...this.events.from(actor, communityId),
      entityId: phase.id,
      data: { name: phase.name, code: phase.code },
    });
    return phase;
  }

  async findMany(communityId: string, query: QueryPhaseDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.PhaseWhereInput = {
      communityId,
      deletedAt: null,
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
      this.prisma.phase.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'sortOrder'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.phase.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const phase = await this.prisma.phase.findFirst({ where: { id, deletedAt: null } });
    if (!phase) throw new NotFoundException('Phase not found');
    await this.access.assert(phase.communityId);
    return phase;
  }

  async update(id: string, dto: UpdatePhaseDto, actor: AuthenticatedUser) {
    await this.findOne(id);
    return this.prisma.phase.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
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
    await this.prisma.phase.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }
}
