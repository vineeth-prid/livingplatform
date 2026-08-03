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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RequireCommunityModule } from '../../common/guards/module-enabled.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  CollectionSummaryQueryDto,
  GenerateInvoicesDto,
  QueryInvoiceDto,
  QueryMaintenanceChargeDto,
  RecordOfflinePaymentDto,
  UpdateInvoiceDto,
  UpsertMaintenanceChargeDto,
} from './dto/billing.dto';
import { InvoiceService } from './invoice.service';
import { MaintenanceChargeService } from './maintenance-charge.service';

/**
 * Maintenance charge configuration by property type.
 *
 * Gated at the class level on the community's `maintenanceBillingEnabled`
 * toggle — a community that does not hand collection to Living has no rate
 * cards, and every route here 404s for them.
 */
@ApiTags('Maintenance Billing · Charges')
@ApiBearerAuth()
@RequireCommunityModule('maintenanceBilling')
@Controller('communities/:communityId/maintenance-charges')
export class MaintenanceChargeController {
  constructor(private readonly charges: MaintenanceChargeService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BILLING_CHARGE_READ)
  @ApiOperation({ summary: 'Rate cards, including scheduled future revisions' })
  list(@Param('communityId') communityId: string, @Query() query: QueryMaintenanceChargeDto) {
    return this.charges.findMany(communityId, query);
  }

  @Get('current')
  @RequirePermissions(PERMISSIONS.BILLING_CHARGE_READ)
  @ApiOperation({ summary: 'The rate in force today, one row per property type' })
  current(@Param('communityId') communityId: string) {
    return this.charges.current(communityId);
  }

  @Get('property-types')
  @RequirePermissions(PERMISSIONS.BILLING_CHARGE_READ)
  @ApiOperation({ summary: 'Property types this community uses, with unit counts' })
  propertyTypes(@Param('communityId') communityId: string) {
    return this.charges.propertyTypes(communityId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BILLING_CHARGE_MANAGE)
  @ApiOperation({ summary: 'Add a rate (a future effectiveFrom schedules a revision)' })
  create(
    @Param('communityId') communityId: string,
    @Body() dto: UpsertMaintenanceChargeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.charges.create(communityId, dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BILLING_CHARGE_MANAGE)
  update(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: UpsertMaintenanceChargeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.charges.update(communityId, id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BILLING_CHARGE_MANAGE)
  remove(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.charges.remove(communityId, id, user);
  }
}

/** Invoices, collection dashboard and resident dues. Same module gate. */
@ApiTags('Maintenance Billing · Invoices')
@ApiBearerAuth()
@RequireCommunityModule('maintenanceBilling')
@Controller('communities/:communityId/maintenance-invoices')
export class MaintenanceInvoiceController {
  constructor(private readonly invoices: InvoiceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BILLING_INVOICE_READ)
  @ApiOperation({ summary: 'Invoices (residents see only their own)' })
  list(
    @Param('communityId') communityId: string,
    @Query() query: QueryInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoices.findMany(communityId, query, user);
  }

  @Get('my-dues')
  @RequirePermissions(PERMISSIONS.BILLING_INVOICE_READ)
  @ApiOperation({ summary: 'The signed-in resident current due, next due and history' })
  myDues(@Param('communityId') communityId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.myDues(communityId, user);
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.BILLING_DASHBOARD_READ)
  @ApiOperation({ summary: 'Collection dashboard — outstanding, collected, monthly trend' })
  summary(
    @Param('communityId') communityId: string,
    @Query() query: CollectionSummaryQueryDto,
  ) {
    return this.invoices.collectionSummary(communityId, query);
  }

  @Get('by-unit')
  @RequirePermissions(PERMISSIONS.BILLING_DASHBOARD_READ)
  @ApiOperation({ summary: 'Payment status per unit / resident' })
  byUnit(@Param('communityId') communityId: string, @Query() query: QueryInvoiceDto) {
    return this.invoices.paymentStatusByUnit(communityId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BILLING_INVOICE_READ)
  findOne(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoices.findOne(communityId, id, user);
  }

  @Post('generate')
  @RequirePermissions(PERMISSIONS.BILLING_INVOICE_GENERATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a billing run (idempotent per unit + period)' })
  generate(
    @Param('communityId') communityId: string,
    @Body() dto: GenerateInvoicesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoices.generate(communityId, dto, user);
  }

  @Post('refresh-overdue')
  @RequirePermissions(PERMISSIONS.BILLING_INVOICE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply late fees and flag overdue invoices' })
  refreshOverdue(@Param('communityId') communityId: string) {
    return this.invoices.refreshOverdue(communityId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BILLING_INVOICE_UPDATE)
  update(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoices.update(communityId, id, dto, user);
  }

  @Post(':id/record-payment')
  @RequirePermissions(PERMISSIONS.BILLING_INVOICE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a payment collected offline (cash / cheque / NEFT)' })
  recordPayment(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: RecordOfflinePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoices.recordOfflinePayment(communityId, id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BILLING_INVOICE_UPDATE)
  @ApiOperation({ summary: 'Cancel an unpaid invoice' })
  cancel(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoices.cancel(communityId, id, user);
  }
}
