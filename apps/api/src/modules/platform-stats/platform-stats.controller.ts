import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { QueryAuditDto } from './dto/query-audit.dto';
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
  constructor(private readonly stats: PlatformStatsService) {}

  @Get('overview')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Executive dashboard aggregates (communities, users, units)' })
  overview() {
    return this.stats.overview();
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
