import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  AddUnitOwnerDto,
  EndUnitOwnerDto,
  OwnershipGapQueryDto,
  TransferOwnershipDto,
  UpdateUnitOwnerDto,
} from './dto/ownership.dto';
import { UnitOwnershipService } from './unit-ownership.service';

/**
 * Unit ownership — who the association bills, as opposed to who lives there.
 *
 * Hangs off the existing unit routes rather than standing up an "owners"
 * module of its own: an owner is an ordinary Resident, and this is one more
 * fact about a unit. Gated on the resident permissions an admin already holds,
 * so no role needs reseeding.
 */
@ApiTags('Units · Ownership')
@ApiBearerAuth()
@Controller('communities/:communityId/units')
export class UnitOwnershipController {
  constructor(private readonly ownership: UnitOwnershipService) {}

  /**
   * Units with no owner on record. The migration deliberately did not guess, so
   * this is the admin's worklist — declared BEFORE `:unitId` so the literal
   * path is not swallowed by the parameter.
   */
  @Get('ownership-gaps')
  @RequirePermissions(PERMISSIONS.RESIDENT_READ)
  @ApiOperation({ summary: 'Units with nobody recorded as owner, with occupancy as a hint' })
  gaps(
    @Param('communityId') communityId: string,
    @Query() query: OwnershipGapQueryDto,
  ) {
    return this.ownership.gaps(communityId, query.limit ?? 200);
  }

  @Get(':unitId/owners')
  @RequirePermissions(PERMISSIONS.RESIDENT_READ)
  @ApiOperation({ summary: 'Owners of a unit, with ownership and account status' })
  list(@Param('communityId') communityId: string, @Param('unitId') unitId: string) {
    return this.ownership.list(communityId, unitId);
  }

  @Post(':unitId/owners')
  @RequirePermissions(PERMISSIONS.RESIDENT_CREATE)
  @ApiOperation({
    summary: 'Record an owner — link an existing resident, or create one with a login',
  })
  add(
    @Param('communityId') communityId: string,
    @Param('unitId') unitId: string,
    @Body() dto: AddUnitOwnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ownership.add(communityId, unitId, dto, user);
  }

  @Patch(':unitId/owners/:residentId')
  @RequirePermissions(PERMISSIONS.RESIDENT_UPDATE)
  @ApiOperation({ summary: 'Update an ownership record (primary, share, notes)' })
  update(
    @Param('communityId') communityId: string,
    @Param('unitId') unitId: string,
    @Param('residentId') residentId: string,
    @Body() dto: UpdateUnitOwnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ownership.update(communityId, unitId, residentId, dto, user);
  }

  @Delete(':unitId/owners/:residentId')
  @RequirePermissions(PERMISSIONS.RESIDENT_UPDATE)
  @ApiOperation({ summary: 'End an ownership (kept as history — never deleted)' })
  end(
    @Param('communityId') communityId: string,
    @Param('unitId') unitId: string,
    @Param('residentId') residentId: string,
    @Body() dto: EndUnitOwnerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ownership.end(communityId, unitId, residentId, dto ?? {}, user);
  }

  @Post(':unitId/owners/transfer')
  @RequirePermissions(PERMISSIONS.RESIDENT_UPDATE)
  @ApiOperation({ summary: 'Transfer the unit to a new owner (ends the current ones)' })
  transfer(
    @Param('communityId') communityId: string,
    @Param('unitId') unitId: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ownership.transfer(communityId, unitId, dto, user);
  }
}
