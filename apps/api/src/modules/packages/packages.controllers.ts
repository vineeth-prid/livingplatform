import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServicePackageStatus } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RequireCommunityModule } from '../../common/guards/module-enabled.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  PurchasePackageDto,
  QueryPackageDto,
  QueryPurchaseDto,
  RedeemPackageDto,
  UpsertPackageDto,
} from './dto/package.dto';
import { PackagePurchaseService } from './package-purchase.service';
import { PackageService } from './package.service';

/**
 * Service Packages — bundles of EXISTING catalog services.
 *
 * Gated on the community's `servicePackages` module toggle, so a community that
 * does not sell packages has no package surface at all.
 */
@ApiTags('Service Packages')
@ApiBearerAuth()
@RequireCommunityModule('servicePackages')
@Controller('communities/:communityId/packages')
export class PackageController {
  constructor(
    private readonly packages: PackageService,
    private readonly purchases: PackagePurchaseService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PACKAGE_READ)
  @ApiOperation({ summary: 'Packages in this community (admin view — all statuses)' })
  list(@Param('communityId') communityId: string, @Query() query: QueryPackageDto) {
    return this.packages.findMany(communityId, query);
  }

  @Get('available')
  @RequirePermissions(PERMISSIONS.PACKAGE_READ)
  @ApiOperation({
    summary: 'Active packages a resident may buy, filtered to their property type',
  })
  available(
    @Param('communityId') communityId: string,
    @Query('propertyType') propertyType?: string,
  ) {
    return this.packages.listForResident(communityId, propertyType);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PACKAGE_READ)
  findOne(@Param('communityId') communityId: string, @Param('id') id: string) {
    return this.packages.findOne(communityId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PACKAGE_MANAGE)
  @ApiOperation({ summary: 'Create a package from existing catalog services' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: UpsertPackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.packages.create(communityId, dto, user);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.PACKAGE_MANAGE)
  update(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: UpsertPackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.packages.update(communityId, id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.PACKAGE_MANAGE)
  @ApiOperation({ summary: 'Enable or disable a package (never deleted once sold)' })
  setStatus(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body('status') status: ServicePackageStatus,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.packages.setStatus(communityId, id, status, user);
  }

  @Post(':id/duplicate')
  @RequirePermissions(PERMISSIONS.PACKAGE_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Copy a package as an inactive draft' })
  duplicate(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.packages.duplicate(communityId, id, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PACKAGE_MANAGE)
  @ApiOperation({ summary: 'Delete a package that has never been purchased' })
  remove(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.packages.remove(communityId, id, user);
  }

  @Post('purchase')
  @RequirePermissions(PERMISSIONS.PACKAGE_PURCHASE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a purchase — returns a PENDING purchase to open a checkout for',
  })
  purchase(
    @Param('communityId') communityId: string,
    @Body() dto: PurchasePackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.purchase(communityId, dto, user);
  }
}

/** A resident's package purchases and the redemptions they produce. */
@ApiTags('Service Packages')
@ApiBearerAuth()
@RequireCommunityModule('servicePackages')
@Controller('communities/:communityId/package-purchases')
export class PackagePurchaseController {
  constructor(private readonly purchases: PackagePurchaseService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PACKAGE_READ)
  @ApiOperation({ summary: 'Purchases (residents see only their own)' })
  list(
    @Param('communityId') communityId: string,
    @Query() query: QueryPurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.findMany(communityId, query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PACKAGE_READ)
  @ApiOperation({ summary: 'One purchase with its remaining entitlements' })
  findOne(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.findOne(communityId, id, user);
  }

  @Post(':id/redeem')
  @RequirePermissions(PERMISSIONS.SERVICE_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redeem an entitlement — creates an ordinary Service Request',
  })
  redeem(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: RedeemPackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.redeem(communityId, id, dto, user);
  }
}
