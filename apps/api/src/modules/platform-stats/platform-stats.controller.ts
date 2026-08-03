import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CommunityInsightsService } from './community-insights.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { PlatformBusinessService } from './platform-business.service';
import { PlatformStatsService } from './platform-stats.service';

/**
 * Platform Admin analytics. Gated on COMMUNITY_CREATE — a permission only the
 * Platform Admin holds (associations and facility managers never do), so it is
 * an effective "platform operator only" gate without a new permission/reseed.
 */
@ApiTags('Platform · Stats')
@ApiBearerAuth()
@Controller('admin/stats')
export class PlatformStatsController {
  constructor(
    private readonly stats: PlatformStatsService,
    private readonly business: PlatformBusinessService,
  ) {}

  @Get('overview')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Executive dashboard aggregates (communities, users, units)' })
  overview() {
    return this.stats.overview();
  }

  @Get('business')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({
    summary:
      'Platform business intelligence — module adoption, popular services/packages, ' +
      'aggregate revenue and growth. Contains NO per-community financials.',
  })
  businessIntelligence() {
    return this.business.overview();
  }

  @Get('maintenance-enabled')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Maintenance-billing flag per community (yes/no only)' })
  maintenanceEnabled() {
    return this.business.maintenanceByCommunity();
  }

  @Get('audit')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Audit log (search/filter/paginate)' })
  audit(@Query() query: QueryAuditDto) {
    return this.stats.audit(query);
  }

  @Get('audit/summary')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Security/activity counters (trailing 24h)' })
  auditSummary() {
    return this.stats.auditSummary();
  }

  @Get('audit/modules')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Distinct audit modules (for the filter)' })
  auditModules() {
    return this.stats.auditModules();
  }

  @Get('system')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'System info: application, storage, jobs, versions' })
  system() {
    return this.stats.system();
  }
}

/**
 * Community-scoped business intelligence. Separate controller because it is a
 * DIFFERENT audience and a different gate: an association admin reads their own
 * community's numbers here, and `CommunityAccessService.assert` in the service
 * makes cross-community reads impossible.
 */
@ApiTags('Community · Insights')
@ApiBearerAuth()
@Controller('communities/:communityId/insights')
export class CommunityInsightsController {
  constructor(private readonly insights: CommunityInsightsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INSIGHTS_READ)
  @ApiOperation({
    summary: 'Adoption, revenue, top service/package and top vendors for this community',
  })
  overview(@Param('communityId') communityId: string) {
    return this.insights.overview(communityId);
  }
}
