import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type AssetEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
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

  /**
   * Remove a photo. Soft delete; uploader only, unless the caller can manage
   * the asset. A wrong or blurred shot was permanent otherwise — the gallery
   * offered no way to take one back, so the only remedy was leaving it there.
   *
   * Guarded by ASSET_PHOTO_CREATE rather than a new permission, matching the
   * work-order rule that whoever may add a photo may take their own back. A
   * separate permission would need a reseed to grant and would strand this
   * behind a deployment step.
   */
  async remove(assetId: string, photoId: string, actor: AuthenticatedUser) {
    await this.assertAccess(assetId);
    const photo = await this.prisma.assetPhoto.findFirst({
      where: { id: photoId, assetId, deletedAt: null },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    const canManageAny = actor.permissions.includes(PERMISSIONS.ASSET_UPDATE);
    if (photo.uploadedById !== actor.id && !canManageAny) {
      throw new ForbiddenException('You can only remove photos you added');
    }

    await this.prisma.assetPhoto.update({
      where: { id: photoId },
      data: { deletedAt: new Date() },
    });
    // Logged as UPDATED with metadata rather than a PHOTO_REMOVED event type:
    // the enum has no such member, and a migration to add one is a poor trade
    // for an audit line — especially with migrations already queued undeployed.
    await this.history.record({
      assetId,
      eventType: AssetEventType.UPDATED,
      description: 'Photo removed',
      performedById: actor.id,
      metadata: { photoId, storageKey: photo.storageKey },
    });
    return { id: photoId, deleted: true };
  }

  async list(assetId: string) {
    await this.assertAccess(assetId);
    const items = await this.prisma.assetPhoto.findMany({
      where: { assetId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(items.map((p) => this.present(p)));
  }

  /**
   * Sign the URL, don't publish it. The bucket is private, so `resolveUrl`
   * hands the browser a link that 403s and the gallery falls back to "Preview
   * unavailable" — every asset photo ever uploaded looked broken. Signing is
   * local crypto with no round-trip, so per-row is cheap. Same reasoning as
   * ticket-attachment.service.ts.
   */
  private async present<T extends { storageKey: string }>(photo: T) {
    const signed = await this.storage.signDownload(photo.storageKey);
    return { ...photo, url: signed.url };
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
