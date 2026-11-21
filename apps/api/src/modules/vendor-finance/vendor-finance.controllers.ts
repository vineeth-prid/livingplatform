import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import {
  CancelPayoutDto,
  CreateCommissionConfigDto,
  GeneratePayoutsDto,
  InvoiceUploadUrlDto,
  MarkPayoutPaidDto,
  QueryPayoutsDto,
  QueryVendorFinanceDto,
  VendorInvoiceDto,
} from './dto/vendor-finance.dto';
import { VendorFinanceService } from './vendor-finance.service';

@ApiTags('Vendor finance')
@ApiBearerAuth()
@Controller('communities/:communityId/vendor-finance')
export class VendorFinanceController {
  constructor(private readonly finance: VendorFinanceService) {}

  // ── Vendor self-service (declared before :params; not permission-gated —
  //    scoped to the caller's own vendor record, 403 for non-vendors) ──

  @Get('me')
  @ApiOperation({ summary: 'My earnings, transactions and payouts (vendor app)' })
  me(@Param('communityId') communityId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.myOverview(communityId, user);
  }

  @Get('me/payouts/:id')
  @ApiOperation({ summary: 'One of my payouts, with its lines (for the statement/receipt)' })
  async myPayout(@Param('communityId') communityId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.getPayout(communityId, id, await this.finance.myVendorId(communityId, user));
  }

  @Get('me/payouts/:id/invoice')
  async myInvoice(@Param('communityId') communityId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.invoiceDownload(communityId, id, await this.finance.myVendorId(communityId, user));
  }

  // ── Admin ──

  @Get('summary')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_READ)
  summary(@Param('communityId') communityId: string, @Query('vendorId') vendorId?: string) {
    return this.finance.summary(communityId, vendorId || undefined);
  }

  @Get('transactions')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_READ)
  @ApiOperation({ summary: 'Completed service requests as vendor earnings (filterable)' })
  transactions(@Param('communityId') communityId: string, @Query() q: QueryVendorFinanceDto) {
    return this.finance.transactions(communityId, q);
  }

  @Get('vendors/:vendorId/commission')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_READ)
  configs(@Param('communityId') communityId: string, @Param('vendorId') vendorId: string) {
    return this.finance.listConfigs(communityId, vendorId);
  }

  @Post('vendors/:vendorId/commission')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_MANAGE)
  @ApiOperation({ summary: 'New commission terms (effective from a date; old terms are kept)' })
  addConfig(
    @Param('communityId') communityId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: CreateCommissionConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.addConfig(communityId, vendorId, dto, user);
  }

  @Post('commission/:id/deactivate')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_MANAGE)
  deactivate(@Param('communityId') communityId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.deactivateConfig(communityId, id, user);
  }

  @Get('payouts')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_READ)
  payouts(@Param('communityId') communityId: string, @Query() q: QueryPayoutsDto) {
    return this.finance.listPayouts(communityId, q);
  }

  @Post('payouts/generate')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_MANAGE)
  @ApiOperation({ summary: 'Create payout statements for closed weekly/monthly periods' })
  generate(@Param('communityId') communityId: string, @Body() dto: GeneratePayoutsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.generatePayouts(communityId, dto.vendorId, user);
  }

  @Get('payouts/:id')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_READ)
  payout(@Param('communityId') communityId: string, @Param('id') id: string) {
    return this.finance.getPayout(communityId, id);
  }

  @Post('payouts/:id/pay')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_MANAGE)
  @ApiOperation({ summary: 'Record the payout transfer (amount must equal the payable)' })
  pay(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: MarkPayoutPaidDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.markPaid(communityId, id, dto, user);
  }

  @Post('payouts/:id/cancel')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_MANAGE)
  cancel(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: CancelPayoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.cancelPayout(communityId, id, dto, user);
  }

  @Post('payouts/:id/invoice/upload-url')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_MANAGE)
  invoiceUploadUrl(@Param('communityId') communityId: string, @Param('id') id: string, @Body() dto: InvoiceUploadUrlDto) {
    return this.finance.invoiceUploadUrl(communityId, id, dto.fileName, dto.contentType);
  }

  @Put('payouts/:id/invoice')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_MANAGE)
  setInvoice(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: VendorInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finance.setInvoice(communityId, id, dto, user);
  }

  @Get('payouts/:id/invoice')
  @RequirePermissions(PERMISSIONS.VENDOR_FINANCE_READ)
  invoice(@Param('communityId') communityId: string, @Param('id') id: string) {
    return this.finance.invoiceDownload(communityId, id);
  }
}
