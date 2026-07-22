import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { AssetEventType, Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type AssetEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { AssetEventService } from './asset-event.service';
import { ASSET_SORTABLE, assertAssetDatesConsistent } from './asset.constants';
import { CreateAssetDto, QueryAssetDto, UpdateAssetDto } from './dto/asset.dto';

const CATEGORY_SELECT = { id: true, name: true, code: true, color: true, icon: true } as const;
const LOCATION_INCLUDE = {
  block: { select: { id: true, name: true, code: true } },
  floor: { select: { id: true, name: true, level: true } },
  unit: { select: { id: true, unitNumber: true } },
} as const;

@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
    private readonly history: AssetEventService,
  ) {}

  async create(dto: CreateAssetDto, actor: AuthenticatedUser) {
    const community = await this.access.assert(dto.communityId);
    const tenantId = community.tenantId;

    await this.assertCategoryInCommunity(dto.categoryId, dto.communityId);
    await this.assertLocationInCommunity(dto, dto.communityId);
    assertAssetDatesConsistent(dto);
    await this.assertCodeFree(tenantId, dto.assetCode);
    if (dto.serialNumber) await this.assertSerialFree(tenantId, dto.serialNumber);

    const asset = await this.prisma.$transaction(async (tx) => {
      const created = await tx.asset.create({
        data: {
          tenantId,
          communityId: dto.communityId,
          categoryId: dto.categoryId,
          assetCode: dto.assetCode,
          name: dto.name,
          description: dto.description,
          manufacturer: dto.manufacturer,
          model: dto.model,
          serialNumber: dto.serialNumber,
          barcode: dto.barcode,
          qrCode: dto.qrCode,
          locationDescription: dto.locationDescription,
          blockId: dto.blockId,
          floorId: dto.floorId,
          unitId: dto.unitId,
          purchaseDate: dto.purchaseDate,
          installationDate: dto.installationDate,
          warrantyExpiry: dto.warrantyExpiry,
          expectedLifeMonths: dto.expectedLifeMonths,
          status: dto.status ?? 'ACTIVE',
          criticality: dto.criticality ?? 'MEDIUM',
          condition: dto.condition ?? 'GOOD',
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      await this.history.record({
        assetId: created.id, eventType: AssetEventType.CREATED, performedById: actor.id, tx,
      });
      return created;
    });

    this.publish(DomainEventName.AssetCreated, asset, actor, { name: asset.name });
    return asset;
  }

  async findMany(query: QueryAssetDto): Promise<Paginated<unknown>> {
    await this.access.assert(query.communityId);
    const where: Prisma.AssetWhereInput = {
      communityId: query.communityId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.criticality ? { criticality: query.criticality } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.blockId ? { blockId: query.blockId } : {}),
      ...(query.floorId ? { floorId: query.floorId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...this.dateRange('warrantyExpiry', query.warrantyFrom, query.warrantyTo),
      ...this.dateRange('installationDate', query.installedFrom, query.installedTo),
      ...this.dateRange('purchaseDate', query.purchasedFrom, query.purchasedTo),
      ...(query.search ? this.searchWhere(query.search) : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        include: { category: { select: CATEGORY_SELECT }, ...LOCATION_INCLUDE },
        orderBy: resolveSort(query, ASSET_SORTABLE, 'createdAt'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.asset.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: CATEGORY_SELECT },
        ...LOCATION_INCLUDE,
        documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        photos: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.access.assert(asset.communityId);
    return {
      ...asset,
      documents: asset.documents.map((d) => ({ ...d, downloadUrl: this.storage.resolveUrl(d.storageKey) })),
      photos: asset.photos.map((p) => ({ ...p, url: this.storage.resolveUrl(p.storageKey) })),
    };
  }

  async update(id: string, dto: UpdateAssetDto, actor: AuthenticatedUser) {
    const asset = await this.loadOrThrow(id);

    if (dto.categoryId) await this.assertCategoryInCommunity(dto.categoryId, asset.communityId);
    await this.assertLocationInCommunity(dto, asset.communityId);
    assertAssetDatesConsistent({
      purchaseDate: dto.purchaseDate ?? asset.purchaseDate,
      installationDate: dto.installationDate ?? asset.installationDate,
      warrantyExpiry: dto.warrantyExpiry ?? asset.warrantyExpiry,
    });
    if (dto.assetCode && dto.assetCode !== asset.assetCode) {
      await this.assertCodeFree(asset.tenantId, dto.assetCode, id);
    }
    if (dto.serialNumber && dto.serialNumber !== asset.serialNumber) {
      await this.assertSerialFree(asset.tenantId, dto.serialNumber, id);
    }

    const statusChanged = dto.status !== undefined && dto.status !== asset.status;
    const locationChanged =
      (dto.blockId !== undefined && dto.blockId !== asset.blockId) ||
      (dto.floorId !== undefined && dto.floorId !== asset.floorId) ||
      (dto.unitId !== undefined && dto.unitId !== asset.unitId) ||
      (dto.locationDescription !== undefined && dto.locationDescription !== asset.locationDescription);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.asset.update({
        where: { id },
        data: {
          categoryId: dto.categoryId,
          assetCode: dto.assetCode,
          name: dto.name,
          description: dto.description,
          manufacturer: dto.manufacturer,
          model: dto.model,
          serialNumber: dto.serialNumber,
          barcode: dto.barcode,
          qrCode: dto.qrCode,
          locationDescription: dto.locationDescription,
          blockId: dto.blockId,
          floorId: dto.floorId,
          unitId: dto.unitId,
          purchaseDate: dto.purchaseDate,
          installationDate: dto.installationDate,
          warrantyExpiry: dto.warrantyExpiry,
          expectedLifeMonths: dto.expectedLifeMonths,
          status: dto.status,
          criticality: dto.criticality,
          condition: dto.condition,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
          updatedById: actor.id,
        },
      });
      if (statusChanged) {
        await this.history.record({
          assetId: id, eventType: AssetEventType.STATUS_CHANGED, performedById: actor.id,
          metadata: { from: asset.status, to: dto.status! }, tx,
        });
      }
      if (locationChanged) {
        await this.history.record({
          assetId: id, eventType: AssetEventType.LOCATION_CHANGED, performedById: actor.id, tx,
        });
      }
      if (!statusChanged && !locationChanged) {
        await this.history.record({
          assetId: id, eventType: AssetEventType.UPDATED, performedById: actor.id, tx,
        });
      }
      return row;
    });

    if (statusChanged) {
      this.publish(DomainEventName.AssetStatusChanged, updated, actor, {
        status: updated.status, fromStatus: asset.status,
      });
    }
    if (locationChanged) this.publish(DomainEventName.AssetMoved, updated, actor);
    if (!statusChanged && !locationChanged) this.publish(DomainEventName.AssetUpdated, updated, actor);
    return updated;
  }

  /** Soft-delete (archive) — assets are never hard-deleted (lifecycle history is kept). */
  async archive(id: string, actor: AuthenticatedUser) {
    const asset = await this.loadOrThrow(id);
    if (asset.deletedAt) throw new ForbiddenException('Asset is already archived');
    await this.prisma.$transaction(async (tx) => {
      await tx.asset.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actor.id } });
      await this.history.record({
        assetId: id, eventType: AssetEventType.ARCHIVED, performedById: actor.id, tx,
      });
    });
    this.publish(DomainEventName.AssetArchived, asset, actor);
    return { id, archived: true };
  }

  async getEvents(id: string) {
    await this.loadOrThrow(id);
    return this.history.list(id);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async loadOrThrow(id: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.access.assert(asset.communityId);
    return asset;
  }

  private dateRange(field: 'warrantyExpiry' | 'installationDate' | 'purchaseDate', from?: Date, to?: Date) {
    if (!from && !to) return {};
    return { [field]: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
  }

  private searchWhere(search: string): Prisma.AssetWhereInput {
    const contains = { contains: search, mode: 'insensitive' as const };
    return {
      OR: [
        { name: contains }, { assetCode: contains }, { serialNumber: contains },
        { manufacturer: contains }, { model: contains }, { barcode: contains },
      ],
    };
  }

  private publish(
    name: AssetEvent['name'],
    asset: { id: string; communityId: string; assetCode: string },
    actor: AuthenticatedUser,
    extra?: Partial<AssetEvent['data']>,
  ): void {
    const event = {
      name,
      ...this.events.from(actor, asset.communityId),
      entityId: asset.id,
      data: { assetCode: asset.assetCode, ...extra },
    } satisfies Omit<AssetEvent, 'occurredAt'>;
    this.events.publish(event);
  }

  private async assertCategoryInCommunity(categoryId: string, communityId: string) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id: categoryId, communityId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Category does not belong to this community');
  }

  private async assertLocationInCommunity(
    loc: { blockId?: string; floorId?: string; unitId?: string },
    communityId: string,
  ) {
    if (loc.blockId) {
      const block = await this.prisma.block.findFirst({
        where: { id: loc.blockId, communityId, deletedAt: null }, select: { id: true },
      });
      if (!block) throw new BadRequestException('Block does not belong to this community');
    }
    if (loc.floorId) {
      const floor = await this.prisma.floor.findFirst({
        where: { id: loc.floorId, communityId, deletedAt: null }, select: { id: true },
      });
      if (!floor) throw new BadRequestException('Floor does not belong to this community');
    }
    if (loc.unitId) {
      const unit = await this.prisma.unit.findFirst({
        where: { id: loc.unitId, communityId, deletedAt: null }, select: { id: true },
      });
      if (!unit) throw new BadRequestException('Unit does not belong to this community');
    }
  }

  private async assertCodeFree(tenantId: string, assetCode: string, exceptId?: string) {
    const existing = await this.prisma.asset.findFirst({
      where: { tenantId, assetCode, deletedAt: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`Asset code "${assetCode}" already exists`);
  }

  private async assertSerialFree(tenantId: string, serialNumber: string, exceptId?: string) {
    const existing = await this.prisma.asset.findFirst({
      where: { tenantId, serialNumber, deletedAt: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`Serial number "${serialNumber}" already exists`);
  }
}
