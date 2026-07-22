import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateWorkOrderAttachmentDto,
  RequestWorkOrderUploadUrlDto,
} from './dto/attachment.dto';

/** Work order attachments — metadata only, bytes via StorageService. */
@Injectable()
export class WorkOrderAttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
  ) {}

  async requestUploadUrl(workOrderId: string, dto: RequestWorkOrderUploadUrlDto) {
    await this.assertAccess(workOrderId);
    const key = this.storage.buildKey(
      `work-orders/${workOrderId}/attachments`,
      dto.fileName,
    );
    const signed = await this.storage.signUpload(key, { contentType: dto.contentType });
    return { key, uploadUrl: signed.url, expiresAt: signed.expiresAt };
  }

  async add(workOrderId: string, dto: CreateWorkOrderAttachmentDto, actor: AuthenticatedUser) {
    await this.assertAccess(workOrderId);
    const attachment = await this.prisma.workOrderAttachment.create({
      data: {
        workOrderId,
        fileName: dto.fileName,
        contentType: dto.contentType,
        size: dto.size,
        storageKey: dto.storageKey,
        uploadedById: actor.id,
      },
    });
    return this.present(attachment);
  }

  async list(workOrderId: string) {
    await this.assertAccess(workOrderId);
    const items = await this.prisma.workOrderAttachment.findMany({
      where: { workOrderId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((a) => this.present(a));
  }

  private present<T extends { storageKey: string }>(attachment: T) {
    return { ...attachment, downloadUrl: this.storage.resolveUrl(attachment.storageKey) };
  }

  private async assertAccess(workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!workOrder) throw new NotFoundException('Work order not found');
    await this.access.assert(workOrder.communityId);
    return workOrder;
  }
}
