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
  CreateVendorDto,
  QueryVendorDto,
  UpdateVendorDto,
} from './dto/vendor.dto';
import { VendorService } from './vendor.service';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendors: VendorService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VENDOR_READ)
  @ApiOperation({ summary: 'List vendors (tenant-scoped; filter by category/status/community)' })
  list(@Query() query: QueryVendorDto) {
    return this.vendors.findMany(query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.VENDOR_CREATE)
  @ApiOperation({ summary: 'Create a vendor' })
  create(@Body() dto: CreateVendorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vendors.create(dto, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_READ)
  findOne(@Param('id') id: string) {
    return this.vendors.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendors.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vendors.remove(id, user);
  }
}
