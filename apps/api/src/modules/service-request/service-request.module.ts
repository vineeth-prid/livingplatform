import { Module } from '@nestjs/common';

import { TicketModule } from '../ticket/ticket.module';
import {
  ServiceCatalogController,
  ServiceFeedbackController,
  ServiceRequestController,
} from './service-request.controllers';
import { ServiceCatalogService } from './service-catalog.service';
import { ServiceFeedbackService } from './service-feedback.service';
import { ServiceRequestStatusService } from './service-request-status.service';
import { ServiceRequestService } from './service-request.service';

/**
 * The Service Request Engine — requested WORK, separate from the Ticket Engine.
 * Imports TicketModule solely to reuse TicketService for the optional
 * "create a ticket from this request" integration; the Ticket Engine itself is
 * unchanged and independent (the link is a nullable scalar `ticketId`).
 */
@Module({
  imports: [TicketModule],
  controllers: [
    ServiceRequestController,
    ServiceFeedbackController,
    ServiceCatalogController,
  ],
  providers: [
    ServiceRequestService,
    ServiceRequestStatusService,
    ServiceCatalogService,
    ServiceFeedbackService,
  ],
  exports: [ServiceRequestService],
})
export class ServiceRequestModule {}
