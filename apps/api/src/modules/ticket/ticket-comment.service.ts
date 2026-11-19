import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketEventType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DomainEventName } from '../events/domain-events';
import { DomainEventsService } from '../events/domain-events.service';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import { participantWhere } from '../tenancy/participant-scope';
import { CreateCommentDto } from './dto/comment.dto';
import { formatTicketNumber } from './ticket.service';
import { TicketTimelineService } from './ticket-timeline.service';

@Injectable()
export class TicketCommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly timeline: TicketTimelineService,
    private readonly events: DomainEventsService,
  ) {}

  async list(ticketId: string, actor: AuthenticatedUser) {
    await this.assertTicketAccess(ticketId, actor);
    const canSeeInternal = actor.permissions.includes(PERMISSIONS.TICKET_UPDATE);
    return this.prisma.ticketComment.findMany({
      where: {
        ticketId,
        deletedAt: null,
        ...(canSeeInternal ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(ticketId: string, dto: CreateCommentDto, actor: AuthenticatedUser) {
    const ticket = await this.assertTicketAccess(ticketId, actor);
    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: actor.id,
        body: dto.body,
        isInternal: dto.isInternal ?? false,
      },
    });
    await this.timeline.record({
      ticketId,
      type: TicketEventType.COMMENT_ADDED,
      actorId: actor.id,
      reference: comment.id,
      metadata: { isInternal: comment.isInternal },
    });
    this.events.publish({
      name: DomainEventName.TicketCommentAdded,
      ...this.events.from(actor, ticket.communityId),
      entityId: ticketId,
      data: {
        ticketNumber: formatTicketNumber(ticket.number),
        commentId: comment.id,
      },
    });
    return comment;
  }

  private async assertTicketAccess(ticketId: string, actor: AuthenticatedUser) {
    // Party-to-the-ticket check (see participant-scope): a resident cannot read
    // or post on a neighbour's ticket just because they share a community.
    const visible = await participantWhere<Prisma.TicketWhereInput>(
      this.prisma, actor, PERMISSIONS.TICKET_ASSIGN, 'reportedById',
    );
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null, ...visible },
      select: { id: true, communityId: true, number: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    await this.access.assert(ticket.communityId);
    return ticket;
  }
}
