import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { PaymentPurpose } from '@prisma/client';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { UpsertPaymentConfigDto } from './dto/payment-config.dto';
import {
  CreateCheckoutDto,
  QueryPaymentDto,
  RefundPaymentDto,
  VerifyPaymentDto,
} from './dto/payment.dto';
import { PaymentConfigService } from './payment-config.service';
import { PaymentService } from './payment.service';

/**
 * Community payment settings (Feature 2). Two independent Razorpay accounts —
 * MAINTENANCE and SERVICE — per community. Secrets go IN through these routes
 * and never come back out: no response body on this controller contains one.
 */
@ApiTags('Payments · Configuration')
@ApiBearerAuth()
@Controller('communities/:communityId/payment-config')
export class PaymentConfigController {
  constructor(private readonly configs: PaymentConfigService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PAYMENT_CONFIG_READ)
  @ApiOperation({ summary: 'Both collection rails with their configuration status' })
  list(@Param('communityId') communityId: string) {
    return this.configs.list(communityId);
  }

  @Get(':purpose')
  @RequirePermissions(PERMISSIONS.PAYMENT_CONFIG_READ)
  @ApiOperation({ summary: 'One rail (MAINTENANCE | SERVICE) — status only, never secrets' })
  get(@Param('communityId') communityId: string, @Param('purpose') purpose: PaymentPurpose) {
    return this.configs.get(communityId, purpose);
  }

  @Put(':purpose')
  @RequirePermissions(PERMISSIONS.PAYMENT_CONFIG_UPDATE)
  @ApiOperation({ summary: 'Save the Razorpay account for one rail (secrets encrypted at rest)' })
  upsert(
    @Param('communityId') communityId: string,
    @Param('purpose') purpose: PaymentPurpose,
    @Body() dto: UpsertPaymentConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.configs.upsert(communityId, purpose, dto, user);
  }

  @Post(':purpose/verify')
  @RequirePermissions(PERMISSIONS.PAYMENT_CONFIG_UPDATE)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check the stored credentials against the gateway' })
  verify(@Param('communityId') communityId: string, @Param('purpose') purpose: PaymentPurpose) {
    return this.configs.verify(communityId, purpose);
  }
}

/** Platform-Admin: which communities are ready to collect. Status only. */
@ApiTags('Payments · Configuration')
@ApiBearerAuth()
@Controller('admin/payment-config')
export class PlatformPaymentConfigController {
  constructor(private readonly configs: PaymentConfigService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Payment configuration status across communities (no secrets)' })
  overview() {
    return this.configs.platformOverview();
  }
}

/** Collection: opening a checkout, verifying it, refunds and history. */
@ApiTags('Payments')
@ApiBearerAuth()
@Controller('communities/:communityId/payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PAYMENT_READ)
  @ApiOperation({ summary: 'Transaction history (residents see only their own)' })
  list(
    @Param('communityId') communityId: string,
    @Query() query: QueryPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.findMany(communityId, query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PAYMENT_READ)
  findOne(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.findOne(communityId, id, user);
  }

  @Get(':id/receipt')
  @RequirePermissions(PERMISSIONS.PAYMENT_READ)
  @ApiOperation({ summary: 'Receipt payload for a settled payment' })
  receipt(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.receipt(communityId, id, user);
  }

  @Post('checkout')
  @RequirePermissions(PERMISSIONS.PAYMENT_CREATE)
  // A checkout creates a gateway order; cap it so a loop can't flood Razorpay.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open a checkout for an invoice or a service request' })
  checkout(
    @Param('communityId') communityId: string,
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.createCheckout(communityId, dto, user);
  }

  @Post('verify')
  @RequirePermissions(PERMISSIONS.PAYMENT_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the Razorpay checkout handshake and settle' })
  verify(
    @Param('communityId') communityId: string,
    @Body() dto: VerifyPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.verify(communityId, dto, user);
  }

  @Post(':id/refund')
  @RequirePermissions(PERMISSIONS.PAYMENT_REFUND)
  @HttpCode(HttpStatus.OK)
  refund(
    @Param('communityId') communityId: string,
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.refund(communityId, id, dto, user);
  }
}

/**
 * Razorpay webhooks, one endpoint per community rail so each community's own
 * signing secret authenticates its own traffic. Public (Razorpay has no JWT) —
 * the HMAC signature IS the authentication, verified over the raw bytes.
 */
@SkipThrottle()
@ApiExcludeController()
@Controller('payments/webhooks/razorpay')
export class RazorpayWebhookController {
  constructor(private readonly payments: PaymentService) {}

  @Public()
  @Post(':communityId/:purpose')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('communityId') communityId: string,
    @Param('purpose') purpose: PaymentPurpose,
    @Body() raw: unknown,
    @Headers('x-razorpay-signature') signature: string,
    @Res() res: Response,
  ): Promise<void> {
    const rawBody = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
    try {
      const result = await this.payments.handleWebhook({
        communityId,
        purpose,
        rawBody,
        signature: signature ?? '',
      });
      res.status(200).json({ ok: true, ...result });
    } catch {
      // A bad signature is a 403; anything else must not make Razorpay retry
      // forever on a payload we already authenticated.
      res.status(403).json({ ok: false });
    }
  }
}
