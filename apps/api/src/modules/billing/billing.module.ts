import { Module } from '@nestjs/common';

import { BillingSchedulerService } from './billing-scheduler.service';
import {
  MaintenanceChargeController,
  MaintenanceInvoiceController,
} from './billing.controllers';
import { InvoiceService } from './invoice.service';
import { MaintenanceChargeService } from './maintenance-charge.service';

/**
 * Maintenance Billing (Sprint 11, Features 3 + 4).
 *
 * Deliberately named `billing`, NOT `maintenance`: the existing MaintenanceModule
 * is the Preventive Maintenance engine (assets, plans, runs) and this is the
 * money side of "maintenance charges". Two bounded contexts, no rival models.
 *
 * Owns rate cards, invoice generation, late fees, the collection dashboard and
 * resident dues. It holds NO gateway logic — collecting money is PaymentsModule,
 * which depends on this module's `InvoiceService.applyPayment` to credit a bill.
 */
@Module({
  controllers: [MaintenanceChargeController, MaintenanceInvoiceController],
  providers: [MaintenanceChargeService, InvoiceService, BillingSchedulerService],
  exports: [MaintenanceChargeService, InvoiceService, BillingSchedulerService],
})
export class BillingModule {}
