import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('communities/:communityId/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNITY_READ)
  @ApiOperation({ summary: 'Search units, blocks, amenities and documents in a community' })
  searchCommunity(
    @Param('communityId') communityId: string,
    @Query() query: SearchQueryDto,
  ) {
    return this.search.searchCommunity(communityId, query.q, query.limit);
  }
}
