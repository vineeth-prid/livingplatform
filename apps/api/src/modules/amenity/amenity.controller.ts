import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  CreateAmenityDto,
  QueryAmenityDto,
  UpdateAmenityDto,
} from './dto/amenity.dto';
import { AmenityService } from './amenity.service';

@ApiTags('Amenities')
@ApiBearerAuth()
@Controller()
export class AmenityController {
  constructor(private readonly amenities: AmenityService) {}

  @Get('communities/:communityId/amenities')
  @RequirePermissions(PERMISSIONS.AMENITY_READ)
  @ApiOperation({ summary: 'List amenities in a community' })
  list(@Param('communityId') communityId: string, @Query() query: QueryAmenityDto) {
    return this.amenities.findMany(communityId, query);
  }

  @Post('communities/:communityId/amenities')
  @RequirePermissions(PERMISSIONS.AMENITY_CREATE)
  @ApiOperation({ summary: 'Create an amenity' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateAmenityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.amenities.create(communityId, dto, user);
  }

  @Get('amenities/:id')
  @RequirePermissions(PERMISSIONS.AMENITY_READ)
  findOne(@Param('id') id: string) {
    return this.amenities.findOne(id);
  }

  @Patch('amenities/:id')
  @RequirePermissions(PERMISSIONS.AMENITY_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAmenityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.amenities.update(id, dto, user);
  }

  @Delete('amenities/:id')
  @RequirePermissions(PERMISSIONS.AMENITY_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.amenities.remove(id, user);
  }
}
