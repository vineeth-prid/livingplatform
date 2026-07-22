import { Module } from '@nestjs/common';

import {
  WorkOrderAttachmentController,
  WorkOrderController,
  WorkOrderUpdateController,
} from './work-order.controllers';
import { WorkOrderAttachmentService } from './work-order-attachment.service';
import { WorkOrderStatusService } from './work-order-status.service';
import { WorkOrderTimelineService } from './work-order-timeline.service';
import { WorkOrderUpdateService } from './work-order-update.service';
import { WorkOrderService } from './work-order.service';

/**
 * The Work Order Engine — generic execution. Independent of the Ticket and
 * Service Request engines: origins are recorded as a loose { originType,
 * originId } pair with no foreign keys, so any engine can create work orders
 * without this module depending on them.
 */
@Module({
  controllers: [
    WorkOrderController,
    WorkOrderUpdateController,
    WorkOrderAttachmentController,
  ],
  providers: [
    WorkOrderService,
    WorkOrderStatusService,
    WorkOrderTimelineService,
    WorkOrderUpdateService,
    WorkOrderAttachmentService,
  ],
  exports: [WorkOrderService, WorkOrderStatusService],
})
export class WorkOrderModule {}
