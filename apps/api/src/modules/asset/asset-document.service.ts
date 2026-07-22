import { Injectable, NotFoundException } from '@nestjs/common';
import { AssetEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName, type AssetEvent } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { AssetEventService } from './asset-event.service';
import { CreateAssetDocumentDto, RequestAssetUploadUrlDto } from './dto/media.dto';

/** Asset documents — metadata only, bytes via StorageService (provider-agnostic). */
@Injectable()
export class AssetDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly events: DomainEventsService,
    private readonly history: AssetEventService,
  ) {}

  async requestUploadUrl(assetId: string, dto: RequestAssetUploadUrlDto) {
    await this.assertAccess(assetId);
    const key = this.storage.buildKey(`assets/${assetId}/documents`, dto.fileName);
    const signed = await this.storage.signUpload(key, { contentType: dto.contentType });
    return { key, uploadUrl: signed.url, expiresAt: signed.expiresAt };
  }

  async add(assetId: string, dto: CreateAssetDocumentDto, actor: AuthenticatedUser) {
    const asset = await this.assertAccess(assetId);
    const document = await this.prisma.assetDocument.create({
      data: {
        assetId,
        fileName: dto.fileName,
        storageKey: dto.storageKey,
        mimeType: dto.mimeType,
        uploadedById: actor.id,
      },
    });
    await this.history.record({
      assetId, eventType: AssetEventType.DOCUMENT_ADDED, performedById: actor.id,
      metadata: { fileName: dto.fileName },
    });
    this.publish(asset, actor);
    return this.present(document);
  }

  async list(assetId: string) {
    await this.assertAccess(assetId);
    const items = await this.prisma.assetDocument.findMany({
      where: { assetId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((d) => this.present(d));
  }

  private present<T extends { storageKey: string }>(doc: T) {
    return { ...doc, downloadUrl: this.storage.resolveUrl(doc.storageKey) };
  }

  private publish(asset: { id: string; communityId: string; assetCode: string }, actor: AuthenticatedUser) {
    const event = {
      name: DomainEventName.AssetDocumentAdded,
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
