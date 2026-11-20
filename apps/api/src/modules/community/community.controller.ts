import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { QueryCommunityDto } from './dto/query-community.dto';
import { LogoUploadUrlDto, SetLogoDto, UpdateCommunityDto } from './dto/update-community.dto';

@ApiTags('Communities')
@ApiBearerAuth()
@Controller('communities')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Create a community' })
  create(@Body() dto: CreateCommunityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.create(dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNITY_READ)
  @ApiOperation({ summary: 'List communities (tenant-scoped, filter/sort/paginate)' })
  findMany(@Query() query: QueryCommunityDto) {
    return this.community.findMany(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.COMMUNITY_READ)
  @ApiOperation({ summary: 'Get a community with settings and statistics' })
  findOne(@Param('id') id: string) {
    return this.community.findOne(id);
  }

  @Post(':id/logo/upload-url')
  @RequirePermissions(PERMISSIONS.COMMUNITY_UPDATE)
  @ApiOperation({ summary: 'Signed upload for a community logo (PNG/JPG/WebP, max 2 MB)' })
  logoUploadUrl(@Param('id') id: string, @Body() dto: LogoUploadUrlDto) {
    return this.community.logoUploadUrl(id, dto.fileName, dto.contentType);
  }

  @Put(':id/logo')
  @RequirePermissions(PERMISSIONS.COMMUNITY_UPDATE)
  @ApiOperation({ summary: 'Use an uploaded image as the community logo (replaces the previous one)' })
  setLogo(@Param('id') id: string, @Body() dto: SetLogoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.community.setLogo(id, dto.key, user);
  }

  @Delete(':id/logo')
  @RequirePermissions(PERMISSIONS.COMMUNITY_UPDATE)
  @ApiOperation({ summary: 'Remove the custom logo — the default Living branding shows again' })
  removeLogo(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.removeLogo(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.COMMUNITY_UPDATE)
  @ApiOperation({ summary: 'Update a community' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.community.update(id, dto, user);
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.COMMUNITY_UPDATE)
  @ApiOperation({ summary: 'Archive a community' })
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.archive(id, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.COMMUNITY_DELETE)
  @ApiOperation({ summary: 'Soft-delete a community' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.community.remove(id, user);
  }
}
