import { Injectable } from '@nestjs/common';
import { Prisma, TicketEventType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Records the structured, append-only ticket timeline. NEVER stores formatted
 * text — only { type, actor, reference, metadata, timestamp }. The UI composes
 * the human sentence. This is the ticket's own history, distinct from the global
 * audit log.
 */
@Injectable()
export class TicketTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    ticketId: string;
    type: TicketEventType;
    actorId?: string | null;
    reference?: string | null;
    metadata?: Prisma.InputJsonValue;
    /** Pass a transaction client to record atomically with the change. */
    tx?: Prisma.TransactionClient;
  }): Promise<{ id: string }> {
    const client = input.tx ?? this.prisma;
    return client.ticketTimeline.create({
      data: {
        ticketId: input.ticketId,
        type: input.type,
        actorId: input.actorId ?? null,
        reference: input.reference ?? null,
        metadata: input.metadata,
      },
      select: { id: true },
    });
  }

  list(ticketId: string) {
    return this.prisma.ticketTimeline.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
