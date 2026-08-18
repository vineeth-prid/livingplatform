import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { ProvisionCommunityDto } from './dto/provision-community.dto';
import { ResetCommunityAdminPasswordDto } from './dto/reset-community-admin-password.dto';
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

  @Get('communities/:communityId/admin')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({
    summary:
      "A community's Association Admin login (Platform Admin only). The password " +
      'is an argon2 hash and can never be read back — reset it to issue a new one.',
  })
  communityAdmin(@Param('communityId') communityId: string) {
    return this.provisioning.communityAdmin(communityId);
  }

  /**
   * Reset the community admin's password AND email it to them.
   *
   * The existing reset shows the temporary password once on screen and nowhere
   * else, so whoever pressed it had to relay the credential by hand. This does
   * both: the caller still gets it back to display, and the account holder gets
   * it by email. It fails loudly if the mail cannot be queued — reporting
   * success for an undelivered password is worse than not offering the button.
   */
  @Post('communities/:communityId/admin/reset-password')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: "Reset the community admin's password and email it to them (Platform Admin only)" })
  resetCommunityAdminPassword(
    @Param('communityId') communityId: string,
    @Body() dto: ResetCommunityAdminPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.provisioning.resetCommunityAdminPassword(communityId, user, dto.sendEmail ?? true);
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
