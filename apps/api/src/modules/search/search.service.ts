import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CommunityAccessService } from '../tenancy/community-access.service';

/**
 * Global search WITHIN a community across the foundation entities. Kept
 * deliberately simple (case-insensitive `contains` per resource) — the shape of
 * the response (grouped, typed hits) is what future modules and a platform-wide
 * search index will conform to.
 *
 * ponytail: DB `ILIKE` scans, not a search index. Fine at community scale; swap
 * for Postgres full-text (tsvector) or an external index (OpenSearch/Meili) when
 * cross-community search and ranking are needed — the endpoint contract holds.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
  ) {}

  async searchCommunity(communityId: string, q: string, limit: number) {
    await this.access.assert(communityId);
    const contains = { contains: q, mode: 'insensitive' as const };

    const [units, blocks, amenities, documents] = await Promise.all([
      this.prisma.unit.findMany({
        where: {
          communityId,
          deletedAt: null,
          OR: [{ unitNumber: contains }, { type: contains }],
        },
        select: { id: true, unitNumber: true, type: true, status: true },
        take: limit,
      }),
      this.prisma.block.findMany({
        where: {
          communityId,
          deletedAt: null,
          OR: [{ name: contains }, { code: contains }],
        },
        select: { id: true, name: true, code: true, type: true },
        take: limit,
      }),
      this.prisma.amenity.findMany({
        where: {
          communityId,
          deletedAt: null,
          OR: [{ name: contains }, { category: contains }],
        },
        select: { id: true, name: true, category: true },
        take: limit,
      }),
      this.prisma.communityDocument.findMany({
        where: {
          communityId,
          deletedAt: null,
          OR: [{ title: contains }, { description: contains }],
        },
        select: { id: true, title: true, category: true },
        take: limit,
      }),
    ]);

    return {
      query: q,
      results: { units, blocks, amenities, documents },
      counts: {
        units: units.length,
        blocks: blocks.length,
        amenities: amenities.length,
        documents: documents.length,
      },
    };
  }
}
