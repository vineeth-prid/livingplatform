import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
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
        stage: dto.stage,
      },
    });
    return this.present(attachment);
  }

  /**
   * Remove a photo the worker just added. Soft delete; uploader only, unless
   * the caller can manage the work order. Without it a blurred or wrong-stage
   * shot was permanent — and if it was the only AFTER photo it satisfied the
   * completion gate with a picture of nothing useful.
   */
  async remove(workOrderId: string, attachmentId: string, actor: AuthenticatedUser) {
    await this.assertAccess(workOrderId);
    const attachment = await this.prisma.workOrderAttachment.findFirst({
      where: { id: attachmentId, workOrderId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const canManageAny = actor.permissions.includes(PERMISSIONS.WORKORDER_UPDATE);
    if (attachment.uploadedById !== actor.id && !canManageAny) {
      throw new ForbiddenException('You can only remove photos you added');
    }

    await this.prisma.workOrderAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
    return { id: attachmentId, deleted: true };
  }

  async list(workOrderId: string) {
    await this.assertAccess(workOrderId);
    const items = await this.prisma.workOrderAttachment.findMany({
      where: { workOrderId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(items.map((a) => this.present(a)));
  }

  /** Signed, not public — a private bucket 403s a public URL. See
   *  ticket-attachment.service.ts for the full explanation. */
  private async present<T extends { storageKey: string }>(attachment: T) {
    const signed = await this.storage.signDownload(attachment.storageKey);
    return { ...attachment, downloadUrl: signed.url };
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
