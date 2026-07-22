import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile & preferences' })
  me(@CurrentUser('id') userId: string) {
    return this.profile.getMe(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update my profile & preferences' })
  update(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profile.update(user.id, dto, user);
  }
}
