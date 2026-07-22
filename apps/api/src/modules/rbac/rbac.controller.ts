import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from './rbac.constants';
import { RbacService } from './rbac.service';

@ApiTags('RBAC')
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'List all roles and their granted permissions' })
  listRoles() {
    return this.rbac.listRoles();
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.PERMISSION_READ)
  @ApiOperation({ summary: 'List the permission catalog' })
  listPermissions() {
    return this.rbac.listPermissions();
  }
}
