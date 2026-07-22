import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List users in the current tenant' })
  findMany(@Query() query: PaginationQueryDto) {
    return this.users.findMany(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Get a single user with their role assignments' })
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: "Update a user's status" })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.users.updateStatus(id, dto.status);
  }
}
