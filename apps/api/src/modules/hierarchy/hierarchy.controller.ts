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
import { BlockService } from './block.service';
import { CreateBlockDto, QueryBlockDto, UpdateBlockDto } from './dto/block.dto';
import { CreateFloorDto, QueryFloorDto, UpdateFloorDto } from './dto/floor.dto';
import { CreatePhaseDto, QueryPhaseDto, UpdatePhaseDto } from './dto/phase.dto';
import { FloorService } from './floor.service';
import { PhaseService } from './phase.service';

@ApiTags('Hierarchy · Phases')
@ApiBearerAuth()
@Controller()
export class PhasesController {
  constructor(private readonly phases: PhaseService) {}

  @Get('communities/:communityId/phases')
  @RequirePermissions(PERMISSIONS.HIERARCHY_READ)
  @ApiOperation({ summary: 'List phases in a community' })
  list(@Param('communityId') communityId: string, @Query() query: QueryPhaseDto) {
    return this.phases.findMany(communityId, query);
  }

  @Post('communities/:communityId/phases')
  @RequirePermissions(PERMISSIONS.HIERARCHY_CREATE)
  @ApiOperation({ summary: 'Create a phase' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreatePhaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.phases.create(communityId, dto, user);
  }

  @Get('phases/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_READ)
  findOne(@Param('id') id: string) {
    return this.phases.findOne(id);
  }

  @Patch('phases/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePhaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.phases.update(id, dto, user);
  }

  @Delete('phases/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.phases.remove(id, user);
  }
}

@ApiTags('Hierarchy · Blocks')
@ApiBearerAuth()
@Controller()
export class BlocksController {
  constructor(private readonly blocks: BlockService) {}

  @Get('communities/:communityId/blocks')
  @RequirePermissions(PERMISSIONS.HIERARCHY_READ)
  @ApiOperation({ summary: 'List blocks/towers in a community' })
  list(@Param('communityId') communityId: string, @Query() query: QueryBlockDto) {
    return this.blocks.findMany(communityId, query);
  }

  @Post('communities/:communityId/blocks')
  @RequirePermissions(PERMISSIONS.HIERARCHY_CREATE)
  @ApiOperation({ summary: 'Create a block/tower' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: CreateBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blocks.create(communityId, dto, user);
  }

  @Get('blocks/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_READ)
  findOne(@Param('id') id: string) {
    return this.blocks.findOne(id);
  }

  @Patch('blocks/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blocks.update(id, dto, user);
  }

  @Delete('blocks/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.blocks.remove(id, user);
  }
}

@ApiTags('Hierarchy · Floors')
@ApiBearerAuth()
@Controller()
export class FloorsController {
  constructor(private readonly floors: FloorService) {}

  @Get('communities/:communityId/floors')
  @RequirePermissions(PERMISSIONS.HIERARCHY_READ)
  @ApiOperation({ summary: 'List floors in a community (filter by blockId)' })
  list(@Param('communityId') communityId: string, @Query() query: QueryFloorDto) {
    return this.floors.findMany(communityId, query);
  }

  @Post('floors')
  @RequirePermissions(PERMISSIONS.HIERARCHY_CREATE)
  @ApiOperation({ summary: 'Create a floor (under a block)' })
  create(@Body() dto: CreateFloorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.floors.create(dto, user);
  }

  @Get('floors/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_READ)
  findOne(@Param('id') id: string) {
    return this.floors.findOne(id);
  }

  @Patch('floors/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_UPDATE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFloorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.floors.update(id, dto, user);
  }

  @Delete('floors/:id')
  @RequirePermissions(PERMISSIONS.HIERARCHY_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.floors.remove(id, user);
  }
}
