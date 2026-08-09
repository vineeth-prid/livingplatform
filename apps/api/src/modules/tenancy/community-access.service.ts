import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';

export interface AccessibleCommunity {
  id: string;
  tenantId: string;
}

/**
 * The single choke point for "may the caller touch this community?".
 *
 * Every Community-Foundation service calls `assert(communityId)` before it
 * reads or writes child rows. Because `communityId` is denormalized onto every
 * descendant (phase/block/floor/unit/amenity/document), once the parent
 * community is tenant-verified here, child queries can filter by `communityId`
 * alone — no repeated tenant joins on the hot path.
 *
 * Platform-level principals bypass the tenant check. For everyone else a
 * cross-tenant id returns 404 (not 403) so existence never leaks.
 */
@Injectable()
export class CommunityAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async assert(communityId: string): Promise<AccessibleCommunity> {
    const community = await this.prisma.community.findFirst({
      where: { id: communityId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    if (!community) throw new NotFoundException('Community not found');
    // Any tenant the caller can reach — their home tenant, or one they hold a
    // community grant in. A person legitimately spans communities (an owner
    // with flats in two, staff covering three), and each community is its own
    // tenant, so a single-tenant check locked them out of their own places.
    if (!this.tenant.canAccessTenant(community.tenantId)) {
      throw new NotFoundException('Community not found');
    }
    return community;
  }

  /** Tenant filter for community-level list/read queries. */
  tenantWhere(): { tenantId?: string | { in: string[] } } {
    if (this.tenant.isPlatform) return {};
    const tenantIds = this.tenant.tenantIds;
    // Guard with an impossible id rather than an empty `in`, which matches
    // nothing in Postgres but reads like a missing filter.
    if (tenantIds.length === 0) return { tenantId: '__no_tenant__' };
    return tenantIds.length === 1 ? { tenantId: tenantIds[0] } : { tenantId: { in: tenantIds } };
  }
}
