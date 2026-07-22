import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { AmcContractService } from './amc-contract.service';
import { AmcCoverageService } from './amc-coverage.service';
import { AmcSlaService } from './amc-sla.service';
import {
  CreateAMCContractDto, QueryAMCContractDto, RenewAMCContractDto, UpdateAMCContractDto,
} from './dto/amc-contract.dto';
import { AddCoverageDto } from './dto/coverage.dto';
import { CreateSlaRuleDto, UpdateSlaRuleDto } from './dto/sla.dto';

@ApiTags('AMC Contracts')
@ApiBearerAuth()
@Controller('amc/contracts')
export class AmcContractController {
  constructor(
    private readonly contracts: AmcContractService,
    private readonly coverage: AmcCoverageService,
    private readonly sla: AmcSlaService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.AMC_READ)
  @ApiOperation({ summary: 'List AMC contracts (filter/search/sort/paginate — community-scoped)' })
  list(@Query() query: QueryAMCContractDto) {
    return this.contracts.findMany(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.AMC_READ)
  @ApiOperation({ summary: 'Contract details (vendor, coverages, SLA rules, recent history)' })
  findOne(@Param('id') id: string) {
    return this.contracts.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.AMC_CREATE)
  @ApiOperation({ summary: 'Create an AMC contract' })
  create(@Body() dto: CreateAMCContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.AMC_UPDATE)
  @ApiOperation({ summary: 'Update a contract (status transitions activate/terminate here)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAMCContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contracts.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.AMC_DELETE)
  @ApiOperation({ summary: 'Soft-delete a contract' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.remove(id, user);
  }

  @Post(':id/renew')
  @RequirePermissions(PERMISSIONS.AMC_RENEW)
  @ApiOperation({ summary: 'Renew a contract into a new term (sets ACTIVE)' })
  renew(
    @Param('id') id: string,
    @Body() dto: RenewAMCContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contracts.renew(id, dto, user);
  }

  @Get(':id/history')
  @RequirePermissions(PERMISSIONS.AMC_READ)
  @ApiOperation({ summary: 'Immutable contract history' })
  history(@Param('id') id: string) {
    return this.contracts.getHistory(id);
  }

  // ── Coverage ──
  @Get(':id/assets')
  @RequirePermissions(PERMISSIONS.AMC_READ)
  @ApiOperation({ summary: 'Assets covered by the contract' })
  listCoverage(@Param('id') id: string) {
    return this.coverage.list(id);
  }

  @Post(':id/assets')
  @RequirePermissions(PERMISSIONS.AMC_COVERAGE_MANAGE)
  @ApiOperation({ summary: 'Cover an asset under the contract' })
  addCoverage(@Param('id') id: string, @Body() dto: AddCoverageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coverage.add(id, dto, user);
  }

  @Delete(':id/assets/:assetId')
  @RequirePermissions(PERMISSIONS.AMC_COVERAGE_MANAGE)
  @ApiOperation({ summary: 'Remove an asset from the contract' })
  removeCoverage(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coverage.remove(id, assetId, user);
  }

  // ── SLA (create under a contract) ──
  @Post(':id/sla')
  @RequirePermissions(PERMISSIONS.AMC_SLA_MANAGE)
  @ApiOperation({ summary: 'Add an SLA rule to the contract' })
  addSla(@Param('id') id: string, @Body() dto: CreateSlaRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sla.add(id, dto, user);
  }
}

@ApiTags('AMC SLA')
@ApiBearerAuth()
@Controller('amc/sla')
export class AmcSlaController {
  constructor(private readonly sla: AmcSlaService) {}

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.AMC_SLA_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateSlaRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sla.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.AMC_SLA_MANAGE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sla.remove(id, user);
  }
}
