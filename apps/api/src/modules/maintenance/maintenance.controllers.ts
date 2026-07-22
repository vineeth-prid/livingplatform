import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { CreateChecklistItemDto, UpdateChecklistItemDto } from './dto/checklist.dto';
import {
  CreateMaintenancePlanDto, QueryMaintenancePlanDto, UpdateMaintenancePlanDto,
} from './dto/maintenance-plan.dto';
import { MaintenanceChecklistService } from './maintenance-checklist.service';
import { MaintenanceGenerationService } from './maintenance-generation.service';
import { MaintenancePlanService } from './maintenance-plan.service';
import { MaintenanceRunService } from './maintenance-run.service';

@ApiTags('Maintenance Plans')
@ApiBearerAuth()
@Controller('maintenance-plans')
export class MaintenancePlanController {
  constructor(
    private readonly plans: MaintenancePlanService,
    private readonly checklist: MaintenanceChecklistService,
    private readonly runs: MaintenanceRunService,
    private readonly generation: MaintenanceGenerationService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_READ)
  @ApiOperation({ summary: 'List maintenance plans (filter/search/sort/paginate — community-scoped)' })
  list(@Query() query: QueryMaintenancePlanDto) {
    return this.plans.findMany(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_READ)
  @ApiOperation({ summary: 'Plan details (asset, checklist, recent runs)' })
  findOne(@Param('id') id: string) {
    return this.plans.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MAINTENANCE_CREATE)
  @ApiOperation({ summary: 'Create a maintenance plan (computes the first nextRunAt)' })
  create(@Body() dto: CreateMaintenancePlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.plans.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_UPDATE)
  @ApiOperation({ summary: 'Update a plan (toggle isActive to pause/resume; recurrence recomputes nextRunAt)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenancePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.plans.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_DELETE)
  @ApiOperation({ summary: 'Soft-delete a plan (stops all future generation)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.plans.remove(id, user);
  }

  @Post(':id/checklist')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_CHECKLIST_MANAGE)
  @ApiOperation({ summary: 'Add a checklist item to a plan' })
  addChecklistItem(@Param('id') id: string, @Body() dto: CreateChecklistItemDto) {
    return this.checklist.add(id, dto);
  }

  @Get(':id/runs')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_READ)
  @ApiOperation({ summary: 'Immutable run history for a plan' })
  listRuns(@Param('id') id: string) {
    return this.runs.listByPlan(id);
  }

  @Post(':id/generate')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_GENERATE)
  @ApiOperation({ summary: 'Generate a work order now (on-demand; does not shift the schedule)' })
  async generateNow(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const plan = await this.plans.loadOrThrow(id);
    return this.generation.generateNow(plan, user);
  }
}

@ApiTags('Maintenance Checklists')
@ApiBearerAuth()
@Controller('maintenance-checklists')
export class MaintenanceChecklistController {
  constructor(private readonly checklist: MaintenanceChecklistService) {}

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_CHECKLIST_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateChecklistItemDto) {
    return this.checklist.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_CHECKLIST_MANAGE)
  remove(@Param('id') id: string) {
    return this.checklist.remove(id);
  }
}

@ApiTags('Maintenance Runs')
@ApiBearerAuth()
@Controller('maintenance-runs')
export class MaintenanceRunController {
  constructor(private readonly runs: MaintenanceRunService) {}

  @Get(':id')
  @RequirePermissions(PERMISSIONS.MAINTENANCE_READ)
  @ApiOperation({ summary: 'A single maintenance run' })
  findOne(@Param('id') id: string) {
    return this.runs.getOne(id);
  }
}
