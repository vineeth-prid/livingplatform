import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateAssetCategoryDto, QueryAssetCategoryDto, UpdateAssetCategoryDto,
} from './dto/asset-category.dto';

const SORTABLE = ['name', 'code', 'sortOrder', 'createdAt'] as const;

/** The community-scoped, self-nesting asset taxonomy. */
@Injectable()
export class AssetCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
  ) {}

  async create(dto: CreateAssetCategoryDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(dto.communityId);
    if (dto.parentCategoryId) {
      await this.assertParentInCommunity(dto.parentCategoryId, dto.communityId);
    }
    await this.assertCodeFree(dto.communityId, dto.code);
    return this.prisma.assetCategory.create({
      data: {
        tenantId: community.tenantId,
        communityId: dto.communityId,
        parentCategoryId: dto.parentCategoryId ?? null,
        name: dto.name,
        code: dto.code,
        icon: dto.icon,
        color: dto.color,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
  }

  async findMany(query: QueryAssetCategoryDto): Promise<Paginated<unknown>> {
    await this.access.assert(query.communityId);
    const where: Prisma.AssetCategoryWhereInput = {
      communityId: query.communityId,
      deletedAt: null,
      ...(query.activeOnly ? { isActive: true } : {}),
      ...(query.parentCategoryId ? { parentCategoryId: query.parentCategoryId } : {}),
      ...(query.search
        ? { OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ] }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.assetCategory.findMany({
        where,
        include: { _count: { select: { assets: true, childCategories: true } } },
        orderBy: resolveSort(query, SORTABLE, 'sortOrder'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.assetCategory.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id, deletedAt: null },
      include: {
        childCategories: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { assets: true } },
      },
    });
    if (!category) throw new NotFoundException('Asset category not found');
    await this.access.assert(category.communityId);
    return category;
  }

  async update(id: string, dto: UpdateAssetCategoryDto, actor: AuthenticatedUser) {
    const category = await this.loadOrThrow(id);
    if (dto.parentCategoryId) {
      if (dto.parentCategoryId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.assertParentInCommunity(dto.parentCategoryId, category.communityId);
    }
    return this.prisma.assetCategory.update({
      where: { id },
      data: {
        name: dto.name,
        parentCategoryId: dto.parentCategoryId,
        icon: dto.icon,
        color: dto.color,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        updatedById: actor.id,
      },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const category = await this.loadOrThrow(id);
    const inUse = await this.prisma.asset.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException('Category is in use by assets and cannot be deleted');
    }
    await this.prisma.assetCategory.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actor.id },
    });
    void category;
    return { id, deleted: true };
  }

  private async loadOrThrow(id: string) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!category) throw new NotFoundException('Asset category not found');
    await this.access.assert(category.communityId);
    return category;
  }

  private async assertParentInCommunity(parentId: string, communityId: string) {
    const parent = await this.prisma.assetCategory.findFirst({
      where: { id: parentId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new BadRequestException('Parent category does not belong to this community');
  }

  private async assertCodeFree(communityId: string, code: string) {
    const existing = await this.prisma.assetCategory.findFirst({
      where: { communityId, code, deletedAt: null },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`Category code "${code}" already exists in this community`);
  }
}
