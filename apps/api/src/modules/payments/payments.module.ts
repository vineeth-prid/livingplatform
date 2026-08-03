import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { PaymentConfigService } from './payment-config.service';
import { PaymentService } from './payment.service';
import {
  PaymentConfigController,
  PaymentController,
  PlatformPaymentConfigController,
  RazorpayWebhookController,
} from './payments.controllers';

/**
 * Payments (Sprint 11) — the ONLY payment implementation on the platform.
 *
 * Community-scoped Razorpay accounts (two rails: maintenance and service),
 * checkout, signature verification, webhooks, refunds and transaction history.
 * Reuses the existing tenancy guard, RBAC, audit and domain events; the money
 * arithmetic and invoice credit rules live in BillingModule, which this module
 * consumes (never the other way round).
 */
@Module({
  imports: [BillingModule],
  controllers: [
    PaymentConfigController,
    PlatformPaymentConfigController,
    PaymentController,
    RazorpayWebhookController,
  ],
  providers: [PaymentConfigService, PaymentService],
  exports: [PaymentConfigService, PaymentService],
})
export class PaymentsModule {}
