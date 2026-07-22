import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateAmenityDto,
  QueryAmenityDto,
  UpdateAmenityDto,
} from './dto/amenity.dto';

const SORTABLE = ['name', 'category', 'sortOrder', 'createdAt', 'status'] as const;

@Injectable()
export class AmenityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
  ) {}

  async create(communityId: string, dto: CreateAmenityDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const amenity = await this.prisma.amenity.create({
      data: {
        communityId,
        name: dto.name,
        code: dto.code,
        category: dto.category,
        description: dto.description,
        capacity: dto.capacity,
        location: dto.location,
        isBookable: dto.isBookable ?? false,
        operatingHours: dto.operatingHours as Prisma.InputJsonValue | undefined,
        imageKey: dto.imageKey,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    this.events.publish({
      name: DomainEventName.AmenityCreated,
      ...this.events.from(actor, communityId),
      entityId: amenity.id,
      data: { name: amenity.name },
    });
    return this.present(amenity);
  }

  async findMany(communityId: string, query: QueryAmenityDto): Promise<Paginated<unknown>> {
    await this.access.assert(communityId);
    const where: Prisma.AmenityWhereInput = {
      communityId,
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.isBookable !== undefined ? { isBookable: query.isBookable } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.amenity.findMany({
        where,
        orderBy: resolveSort(query, SORTABLE, 'sortOrder'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.amenity.count({ where }),
    ]);
    return paginate(items.map((a) => this.present(a)), total, query);
  }

  async findOne(id: string) {
    const amenity = await this.prisma.amenity.findFirst({
      where: { id, deletedAt: null },
    });
    if (!amenity) throw new NotFoundException('Amenity not found');
    await this.access.assert(amenity.communityId);
    return this.present(amenity);
  }

  async update(id: string, dto: UpdateAmenityDto, actor: AuthenticatedUser) {
    await this.findOne(id);
    const updated = await this.prisma.amenity.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        category: dto.category,
        description: dto.description,
        capacity: dto.capacity,
        location: dto.location,
        isBookable: dto.isBookable,
        operatingHours: dto.operatingHours as Prisma.InputJsonValue | undefined,
        imageKey: dto.imageKey,
        sortOrder: dto.sortOrder,
        status: dto.status,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
      },
    });
    return this.present(updated);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findOne(id);
    await this.prisma.amenity.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    return { id, deleted: true };
  }

  private present<T extends { imageKey: string | null }>(amenity: T) {
    return { ...amenity, imageUrl: this.storage.resolveUrl(amenity.imageKey) };
  }
}
