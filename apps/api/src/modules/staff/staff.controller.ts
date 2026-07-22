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
  CreateStaffDto,
  QueryStaffDto,
  UpdateStaffDto,
} from './dto/staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('communities/:communityId/staff')
  @RequirePermissions(PERMISSIONS.STAFF_READ)
  @ApiOperation({ summary: 'List staff (filter by role/department/status, search)' })
  list(@Param('communityId') communityId: string, @Query() query: QueryStaffDto) {
    return this.staff.findMany(communityId, query);
  }

  @Post('communities/:communityId/staff')
  @RequirePermissions(PERMISSIONS.STAFF_CREATE)
  @ApiOperation({ summary: 'Create a staff member' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staff.create(communityId, dto, user);
  }

  @Get('staff/:id')
  @RequirePermissions(PERMISSIONS.STAFF_READ)
  findOne(@Param('id') id: string) {
    return this.staff.findOne(id);
  }

  @Patch('staff/:id')
  @RequirePermissions(PERMISSIONS.STAFF_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staff.update(id, dto, user);
  }

  @Delete('staff/:id')
  @RequirePermissions(PERMISSIONS.STAFF_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.staff.remove(id, user);
  }
}
