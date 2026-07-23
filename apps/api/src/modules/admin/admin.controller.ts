import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { ProvisionCommunityDto } from './dto/provision-community.dto';
import { ProvisioningService } from './provisioning.service';

const meta = (req: Request) => ({ userAgent: req.headers['user-agent'], ipAddress: req.ip });

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

  @Post('communities/:communityId/login-as')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: "Mint a session for a community's Association Admin (Platform Admin only)" })
  loginAsCommunity(
    @Param('communityId') communityId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.provisioning.loginAsCommunity(communityId, user, meta(req));
  }
}
