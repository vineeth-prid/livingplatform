import { Injectable, NotFoundException } from '@nestjs/common';
import { AssetEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type AssetEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { AssetEventService } from './asset-event.service';
import { CreateAssetPhotoDto, RequestAssetUploadUrlDto } from './dto/media.dto';

/** Asset photos — metadata only, bytes via StorageService (provider-agnostic). */
@Injectable()
export class AssetPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
    private readonly history: AssetEventService,
  ) {}

  async requestUploadUrl(assetId: string, dto: RequestAssetUploadUrlDto) {
    await this.assertAccess(assetId);
    const key = this.storage.buildKey(`assets/${assetId}/photos`, dto.fileName);
    const signed = await this.storage.signUpload(key, { contentType: dto.contentType });
    return { key, uploadUrl: signed.url, expiresAt: signed.expiresAt };
  }

  async add(assetId: string, dto: CreateAssetPhotoDto, actor: AuthenticatedUser) {
    const asset = await this.assertAccess(assetId);
    const photo = await this.prisma.assetPhoto.create({
      data: {
        assetId,
        storageKey: dto.storageKey,
        caption: dto.caption,
        uploadedById: actor.id,
      },
    });
    await this.history.record({
      assetId, eventType: AssetEventType.PHOTO_ADDED, performedById: actor.id,
    });
    this.publish(asset, actor);
    return this.present(photo);
  }

  async list(assetId: string) {
    await this.assertAccess(assetId);
    const items = await this.prisma.assetPhoto.findMany({
      where: { assetId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((p) => this.present(p));
  }

  private present<T extends { storageKey: string }>(photo: T) {
    return { ...photo, url: this.storage.resolveUrl(photo.storageKey) };
  }

  private publish(asset: { id: string; communityId: string; assetCode: string }, actor: AuthenticatedUser) {
    const event = {
      name: DomainEventName.AssetPhotoAdded,
      ...this.events.from(actor, asset.communityId),
      entityId: asset.id,
      data: { assetCode: asset.assetCode },
    } satisfies Omit<AssetEvent, 'occurredAt'>;
    this.events.publish(event);
  }

  private async assertAccess(assetId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, deletedAt: null },
      select: { id: true, communityId: true, assetCode: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.access.assert(asset.communityId);
    return asset;
  }
}
