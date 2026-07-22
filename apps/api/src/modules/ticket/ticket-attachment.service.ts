import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
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

  async list(ticketId: string) {
    await this.assertTicketAccess(ticketId);
    const items = await this.prisma.ticketAttachment.findMany({
      where: { ticketId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((a) => this.present(a));
  }

  private present<T extends { storageKey: string }>(attachment: T) {
    return { ...attachment, downloadUrl: this.storage.resolveUrl(attachment.storageKey) };
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
