import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { UpdateCommunitySettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Community Settings')
@ApiBearerAuth()
@Controller('communities/:communityId/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'Get community settings' })
  get(@Param('communityId') communityId: string) {
    return this.settings.get(communityId);
  }

  /**
   * The module toggles only. Deliberately gated on COMMUNITY_READ rather than
   * SETTINGS_READ: every resident needs this to know whether to render the
   * maintenance and packages surfaces, and they must not see the rest of the
   * settings document to find out.
   */
  @Get('features')
  @RequirePermissions(PERMISSIONS.COMMUNITY_READ)
  @ApiOperation({ summary: 'Which optional modules are enabled for this community' })
  features(@Param('communityId') communityId: string) {
    return this.settings.features(communityId);
  }

  @Put()
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Update (upsert) community settings' })
  update(
    @Param('communityId') communityId: string,
    @Body() dto: UpdateCommunitySettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.update(communityId, dto, user);
  }
}
