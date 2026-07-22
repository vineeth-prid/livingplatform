import { Injectable } from '@nestjs/common';
import { AssetEventType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Records the asset's immutable, append-only history (structured type + optional
 * metadata — never formatted text). This is the asset's timeline; it reuses the
 * same pattern as the engines' structured timelines rather than duplicating one.
 */
@Injectable()
export class AssetEventService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    assetId: string;
    eventType: AssetEventType;
    description?: string | null;
    performedById?: string | null;
    metadata?: Prisma.InputJsonValue;
    tx?: Prisma.TransactionClient;
  }): Promise<{ id: string }> {
    const client = input.tx ?? this.prisma;
    return client.assetEvent.create({
      data: {
        assetId: input.assetId,
        eventType: input.eventType,
        description: input.description ?? null,
        performedById: input.performedById ?? null,
        metadata: input.metadata,
      },
      select: { id: true },
    });
  }

  list(assetId: string) {
    return this.prisma.assetEvent.findMany({
      where: { assetId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
