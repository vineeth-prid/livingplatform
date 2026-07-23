import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CatalogService } from './catalog.service';

class CreateOptionDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
}

@ApiTags('Catalog Options')
@ApiBearerAuth()
@Controller('catalog-options')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @ApiOperation({ summary: 'List options for a catalog kind (STAFF_ROLE, VENDOR_CATEGORY)' })
  list(@Query('kind') kind: string) {
    return this.catalog.list(kind);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Add a tenant option' })
  create(@Query('kind') kind: string, @Body() dto: CreateOptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalog.create(kind, dto.name, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Remove a tenant option' })
  remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }
}
