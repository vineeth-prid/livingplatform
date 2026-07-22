import { Module } from '@nestjs/common';

import { AmcContractController, AmcSlaController } from './amc.controllers';
import { AmcContractService } from './amc-contract.service';
import { AmcCoverageService } from './amc-coverage.service';
import { AmcExpiryService } from './amc-expiry.service';
import { AmcHistoryService } from './amc-history.service';
import { AmcSlaService } from './amc-sla.service';

/**
 * AMC Management Engine (Sprint 9) — the contractual layer. Records who (vendor)
 * is responsible for which assets, until when, under what SLA, at what cost. It
 * never executes work (Work Order Engine) or schedules it (Preventive
 * Maintenance), and never owns assets (coverage is an FK only). Reuses the
 * platform's tenancy, events, audit, RBAC and the shared cron registry; a daily
 * sweep transitions contracts to EXPIRED / RENEWAL_PENDING.
 */
@Module({
  controllers: [AmcContractController, AmcSlaController],
  providers: [
    AmcContractService,
    AmcCoverageService,
    AmcSlaService,
    AmcHistoryService,
    AmcExpiryService,
  ],
  exports: [AmcContractService],
})
export class AmcModule {}
