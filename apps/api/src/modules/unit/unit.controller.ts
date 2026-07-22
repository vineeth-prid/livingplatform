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
import { CreateUnitDto, QueryUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { UnitService } from './unit.service';

@ApiTags('Units')
@ApiBearerAuth()
@Controller()
export class UnitController {
  constructor(private readonly units: UnitService) {}

  @Get('communities/:communityId/units')
  @RequirePermissions(PERMISSIONS.UNIT_READ)
  @ApiOperation({ summary: 'List units in a community (filter/sort/paginate)' })
  list(@Param('communityId') communityId: string, @Query() query: QueryUnitDto) {
    return this.units.findMany(communityId, query);
  }

  @Post('communities/:communityId/units')
  @RequirePermissions(PERMISSIONS.UNIT_CREATE)
  @ApiOperation({ summary: 'Create a unit' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateUnitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.units.create(communityId, dto, user);
  }

  @Get('units/:id')
  @RequirePermissions(PERMISSIONS.UNIT_READ)
  @ApiOperation({ summary: 'Get a unit with its hierarchy context' })
  findOne(@Param('id') id: string) {
    return this.units.findOne(id);
  }

  @Patch('units/:id')
  @RequirePermissions(PERMISSIONS.UNIT_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.units.update(id, dto, user);
  }

  @Delete('units/:id')
  @RequirePermissions(PERMISSIONS.UNIT_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.units.remove(id, user);
  }
}
