import { Injectable } from '@nestjs/common';
import { Prisma, WorkOrderEventType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Records the structured, append-only Work Order timeline (never formatted text).
 */
@Injectable()
export class WorkOrderTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    workOrderId: string;
    type: WorkOrderEventType;
    actorId?: string | null;
    reference?: string | null;
    metadata?: Prisma.InputJsonValue;
    tx?: Prisma.TransactionClient;
  }): Promise<{ id: string }> {
    const client = input.tx ?? this.prisma;
    return client.workOrderTimeline.create({
      data: {
        workOrderId: input.workOrderId,
        type: input.type,
        actorId: input.actorId ?? null,
        reference: input.reference ?? null,
        metadata: input.metadata,
      },
      select: { id: true },
    });
  }

  list(workOrderId: string) {
    return this.prisma.workOrderTimeline.findMany({
      where: { workOrderId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
