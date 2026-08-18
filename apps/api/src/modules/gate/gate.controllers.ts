import {
  BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { GateEntryType } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { GateAnalyticsService } from './gate-analytics.service';
import { GateEntryService } from './gate-entry.service';
import { GateService } from './gate.service';
import {
  CreateGateDto,
  CreateGateEntryDto,
  GateDecisionDto,
  GateStatisticsQueryDto,
  InviteVisitorDto,
  QueryGateEntryDto,
  UpdateGateEntryDto,
} from './dto/gate-entry.dto';

/**
 * Gate Management — deliveries.
 *
 * The route surface is `/gate/deliveries/*` as specified. Under the hood every
 * handler delegates to the entry-type-agnostic service with `DELIVERY` pinned,
 * so the sibling surfaces (`/gate/visitors`, `/gate/vehicles`) are a controller
 * away, not an engine away.
 *
 * Note the ordering: `/gate/deliveries/mine` and `/statistics` are declared
 * BEFORE `/:id`, or the param route would swallow them.
 */
@ApiTags('Gate Management')
@ApiBearerAuth()
@Controller('gate/deliveries')
export class GateDeliveryController {
  constructor(
    private readonly entries: GateEntryService,
    private readonly analytics: GateAnalyticsService,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.GATE_ENTRY_CREATE)
  @ApiOperation({
    summary: 'Record a delivery at the gate (notifies the resident via the Notification Engine)',
  })
  create(
    @Query('communityId') communityId: string,
    @Body() dto: CreateGateEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entries.create(
      communityId,
      { ...dto, entryType: dto.entryType ?? GateEntryType.DELIVERY },
      user,
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.GATE_ENTRY_VIEW)
  @ApiOperation({ summary: 'The gate register (filter, search, paginate)' })
  list(@Query() query: QueryGateEntryDto, @CurrentUser() user: AuthenticatedUser) {
    // Read from the DTO, not a second @Query('communityId') parameter: the
    // ValidationPipe whitelists the WHOLE query object, so anything not
    // declared on the DTO is rejected. One source of truth avoids that trap.
    if (!query.communityId) {
      throw new BadRequestException('communityId is required');
    }
    return this.entries.findMany(query.communityId, query, user);
  }

  /**
   * The signed-in resident's own deliveries. Self-scoped and therefore NOT
   * permission-gated — residents deliberately hold no gate permission, exactly
   * like `/residents/me`.
   */
  @Get('mine')
  @ApiOperation({ summary: 'My own gate entries (resident self-service)' })
  mine(@Query() query: QueryGateEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.entries.findMine(query, user);
  }

  /**
   * A resident invites a visitor to their own flat.
   *
   * No `@RequirePermissions`: residents deliberately hold no gate permission,
   * and the authorisation is the unit assignment itself (same posture as the
   * `/mine` route above). The service refuses any unit the caller does not
   * occupy.
   */
  @Post('visitors')
  @ApiOperation({ summary: 'Invite a visitor to one of my units (resident self-service)' })
  inviteVisitor(@Body() dto: InviteVisitorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.entries.inviteVisitor(dto, user);
  }

  /** The units a resident may invite a visitor to. */
  @Get('my-units')
  @ApiOperation({ summary: 'Units I occupy, for the visitor invite form' })
  myUnits(@CurrentUser() user: AuthenticatedUser) {
    return this.entries.myUnits(user);
  }

  @Get('units/:unitId/occupants')
  @RequirePermissions(PERMISSIONS.GATE_ENTRY_CREATE)
  @ApiOperation({
    summary: 'Who lives in a unit (name + mobile only) — for gate confirmation',
  })
  occupants(
    @Query('communityId') communityId: string,
    @Param('unitId') unitId: string,
  ) {
    return this.entries.unitOccupants(communityId, unitId);
  }

  @Post('upload-url')
  @RequirePermissions(PERMISSIONS.GATE_ENTRY_CREATE)
  @ApiOperation({ summary: 'Signed upload target for the gate photo' })
  uploadUrl(
    @Query('communityId') communityId: string,
    @Body() body: { fileName: string; contentType?: string },
  ) {
    return this.entries.photoUploadUrl(communityId, body.fileName, body.contentType);
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.GATE_ANALYTICS_READ)
  @ApiOperation({ summary: 'Delivery analytics: volumes, approval time, top vendors, peak hours' })
  statistics(@Query() query: GateStatisticsQueryDto) {
    if (!query.communityId) {
      throw new BadRequestException('communityId is required');
    }
    return this.analytics.statistics(query.communityId, query.days ?? 30);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One entry with its full timeline (own entry, or with gate:entry:view)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.entries.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GATE_ENTRY_UPDATE)
  @ApiOperation({ summary: 'Correct an entry’s details' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGateEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entries.update(id, dto, user);
  }

  /** Resident decisions. Ownership-checked in the service, not by RBAC. */
  @Post(':id/approve')
  @ApiOperation({ summary: 'Resident approves — security is updated in real time' })
  approve(
    @Param('id') id: string,
    @Body() dto: GateDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entries.approve(id, dto, user);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Resident rejects — security is updated in real time' })
  reject(
    @Param('id') id: string,
    @Body() dto: GateDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entries.reject(id, dto, user);
  }

  @Post(':id/viewed')
  @ApiOperation({ summary: 'Mark that the resident opened the notification (audit trail)' })
  viewed(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.entries.markViewed(id, user);
  }

  @Post(':id/complete')
  @RequirePermissions(PERMISSIONS.GATE_ENTRY_COMPLETE)
  @ApiOperation({ summary: 'Security hands the delivery over and closes the entry' })
  complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.entries.complete(id, user);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.GATE_ENTRY_UPDATE)
  @ApiOperation({ summary: 'Cancel an entry recorded in error' })
  cancel(
    @Param('id') id: string,
    @Body() dto: GateDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.entries.cancel(id, dto, user);
  }
}

/** The community's named gates. Small CRUD, manager-only. */
@ApiTags('Gate Management')
@ApiBearerAuth()
@Controller('communities/:communityId/gates')
export class GateController {
  constructor(private readonly gates: GateService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GATE_ENTRY_VIEW)
  @ApiOperation({ summary: 'List the community’s gates' })
  list(@Param('communityId') communityId: string) {
    return this.gates.findMany(communityId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GATE_MANAGE)
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateGateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gates.create(communityId, dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GATE_MANAGE)
  update(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: CreateGateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gates.update(communityId, id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.GATE_MANAGE)
  remove(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.gates.remove(communityId, id, user);
  }
}
