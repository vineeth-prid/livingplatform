import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { ProvisionCommunityDto } from './dto/provision-community.dto';
import { ProvisioningService } from './provisioning.service';

/** Platform-Admin control plane — provisioning customers (communities + their admin). */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly provisioning: ProvisioningService) {}

  @Post('communities')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Provision a community and its Association Admin (Platform Admin only)' })
  provisionCommunity(@Body() dto: ProvisionCommunityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.provisioning.provisionCommunity(dto, user);
  }
}
