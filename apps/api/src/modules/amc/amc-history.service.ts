import { Injectable } from '@nestjs/common';
import { AMCEventType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/** Records the immutable, append-only AMC contract history (structured events). */
@Injectable()
export class AmcHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    contractId: string;
    eventType: AMCEventType;
    description?: string | null;
    performedById?: string | null;
    metadata?: Prisma.InputJsonValue;
    tx?: Prisma.TransactionClient;
  }): Promise<{ id: string }> {
    const client = input.tx ?? this.prisma;
    return client.aMCHistory.create({
      data: {
        contractId: input.contractId,
        eventType: input.eventType,
        description: input.description ?? null,
        performedById: input.performedById ?? null,
        metadata: input.metadata,
      },
      select: { id: true },
    });
  }

  list(contractId: string) {
    return this.prisma.aMCHistory.findMany({
      where: { contractId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
