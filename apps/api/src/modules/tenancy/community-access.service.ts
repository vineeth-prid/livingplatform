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
    if (!this.tenant.isPlatform && community.tenantId !== this.tenant.tenantId) {
      throw new NotFoundException('Community not found');
    }
    return community;
  }

  /** Tenant filter for community-level list/read queries. */
  tenantWhere(): { tenantId?: string } {
    if (this.tenant.isPlatform) return {};
    // A non-platform principal always has a tenant; guard with an impossible id.
    return { tenantId: this.tenant.tenantId ?? '__no_tenant__' };
  }
}
