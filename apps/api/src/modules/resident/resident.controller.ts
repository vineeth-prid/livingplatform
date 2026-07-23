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

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  AssignUnitDto,
  BulkResidentUploadDto,
  CreateResidentDto,
  QueryResidentDto,
  UpdateResidentDto,
} from './dto/resident.dto';
import { ResidentService } from './resident.service';

@ApiTags('Residents')
@ApiBearerAuth()
@Controller()
export class ResidentController {
  constructor(private readonly residents: ResidentService) {}

  @Get('communities/:communityId/residents')
  @RequirePermissions(PERMISSIONS.RESIDENT_READ)
  @ApiOperation({ summary: 'List residents (filter by status/tower/floor/unit, search)' })
  list(@Param('communityId') communityId: string, @Query() query: QueryResidentDto) {
    return this.residents.findMany(communityId, query);
  }

  @Post('communities/:communityId/residents')
  @RequirePermissions(PERMISSIONS.RESIDENT_CREATE)
  @ApiOperation({ summary: 'Create a resident' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateResidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.residents.create(communityId, dto, user);
  }

  @Post('communities/:communityId/residents/bulk')
  @RequirePermissions(PERMISSIONS.RESIDENT_CREATE)
  @ApiOperation({ summary: 'Bulk upload residents (unit mapped by unit number)' })
  bulkCreate(
    @Param('communityId') communityId: string,
    @Body() dto: BulkResidentUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.residents.bulkCreate(communityId, dto, user);
  }

  @Get('residents/:id')
  @RequirePermissions(PERMISSIONS.RESIDENT_READ)
  @ApiOperation({ summary: 'Get a resident with unit assignment' })
  findOne(@Param('id') id: string) {
    return this.residents.findOne(id);
  }

  @Patch('residents/:id')
  @RequirePermissions(PERMISSIONS.RESIDENT_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateResidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.residents.update(id, dto, user);
  }

  @Delete('residents/:id')
  @RequirePermissions(PERMISSIONS.RESIDENT_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.residents.remove(id, user);
  }

  @Put('residents/:id/unit')
  @RequirePermissions(PERMISSIONS.RESIDENT_ASSIGN)
  @ApiOperation({ summary: 'Assign (or re-assign) the resident to a unit' })
  assignUnit(
    @Param('id') id: string,
    @Body() dto: AssignUnitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.residents.assignUnit(id, dto, user);
  }

  @Delete('residents/:id/unit')
  @RequirePermissions(PERMISSIONS.RESIDENT_ASSIGN)
  @ApiOperation({ summary: 'Remove the resident’s unit assignment' })
  unassignUnit(@Param('id') id: string) {
    return this.residents.unassignUnit(id);
  }
}
