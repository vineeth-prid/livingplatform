import { Module } from '@nestjs/common';

import { GateAnalyticsService } from './gate-analytics.service';
import { GateEntryService } from './gate-entry.service';
import { GateNotificationListener } from './gate-notification.listener';
import { GateService } from './gate.service';
import { GateController, GateDeliveryController } from './gate.controllers';

/**
 * Gate Management — the register of arrivals at a community gate.
 *
 * Delivery is the first supported `entryType`; visitor, service personnel and
 * vehicle entries share the same table, service and lifecycle and need only a
 * controller surface plus a notification template to switch on.
 *
 * Dependencies are all global modules (Prisma, Notification Engine, Realtime,
 * Storage, Events, Tenancy), so this module imports nothing and, more
 * importantly, nothing existing had to import it.
 */
@Module({
  controllers: [GateDeliveryController, GateController],
  providers: [
    GateEntryService,
    GateAnalyticsService,
    GateService,
    GateNotificationListener,
  ],
  exports: [GateEntryService],
})
export class GateModule {}
