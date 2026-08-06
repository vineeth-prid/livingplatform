import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TicketEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CommunityAccessService } from '../tenancy/community-access.service';
import {
  CreateAttachmentDto,
  RequestAttachmentUploadUrlDto,
} from './dto/attachment.dto';
import { TicketTimelineService } from './ticket-timeline.service';

/**
 * Ticket attachments — metadata only, bytes handled via StorageService (the
 * Sprint 2 abstraction). No coupling to any concrete object store.
 */
@Injectable()
export class TicketAttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly timeline: TicketTimelineService,
  ) {}

  async requestUploadUrl(ticketId: string, dto: RequestAttachmentUploadUrlDto) {
    await this.assertTicketAccess(ticketId);
    const key = this.storage.buildKey(
      `tickets/${ticketId}/attachments`,
      dto.fileName,
    );
    const signed = await this.storage.signUpload(key, {
      contentType: dto.contentType,
    });
    return { key, uploadUrl: signed.url, expiresAt: signed.expiresAt };
  }

  async add(ticketId: string, dto: CreateAttachmentDto, actor: AuthenticatedUser) {
    await this.assertTicketAccess(ticketId);
    const attachment = await this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        fileName: dto.fileName,
        contentType: dto.contentType,
        size: dto.size,
        storageKey: dto.storageKey,
        uploadedById: actor.id,
        stage: dto.stage,
      },
    });
    await this.timeline.record({
      ticketId,
      type: TicketEventType.ATTACHMENT_ADDED,
      actorId: actor.id,
      reference: attachment.id,
      metadata: { fileName: dto.fileName },
    });
    return this.present(attachment);
  }

  /**
   * Remove a photo the worker just added.
   *
   * Soft delete, so the evidence trail keeps its history — and scoped to the
   * UPLOADER unless the caller can manage the ticket, because a shared job
   * should not let one worker delete another's site photos.
   *
   * Without this a blurred or wrong-stage shot was permanent: it stayed in the
   * record and, if it was the only AFTER photo, satisfied the resolve gate with
   * a picture of nothing useful.
   */
  async remove(ticketId: string, attachmentId: string, actor: AuthenticatedUser) {
    await this.assertTicketAccess(ticketId);
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, ticketId, deletedAt: null },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const canManageAny = actor.permissions.includes(PERMISSIONS.TICKET_UPDATE);
    if (attachment.uploadedById !== actor.id && !canManageAny) {
      throw new ForbiddenException('You can only remove photos you added');
    }

    await this.prisma.ticketAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
    return { id: attachmentId, deleted: true };
  }

  async list(ticketId: string) {
    await this.assertTicketAccess(ticketId);
    const items = await this.prisma.ticketAttachment.findMany({
      where: { ticketId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(items.map((a) => this.present(a)));
  }

  /**
   * Attach a *signed* download URL, not a public one. The bucket is private, so
   * `resolveUrl` produces a link that 403s — which is why an attachment a
   * technician uploaded on site could never be opened from the portal. Signing
   * is local crypto (no round-trip), so doing it per row is cheap.
   */
  private async present<T extends { storageKey: string }>(attachment: T) {
    const signed = await this.storage.signDownload(attachment.storageKey);
    return { ...attachment, downloadUrl: signed.url };
  }

  private async assertTicketAccess(ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    await this.access.assert(ticket.communityId);
    return ticket;
  }
}
