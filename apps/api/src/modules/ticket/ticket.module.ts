import { Module } from '@nestjs/common';

import {
  TicketAttachmentController,
  TicketCategoryController,
  TicketCommentController,
  TicketController,
} from './ticket.controllers';
import { TicketAttachmentService } from './ticket-attachment.service';
import { TicketCategoryService } from './ticket-category.service';
import { TicketCommentService } from './ticket-comment.service';
import { TicketDashboardService } from './ticket-dashboard.service';
import { TicketService } from './ticket.service';
import { TicketStatusService } from './ticket-status.service';
import { TicketTimelineService } from './ticket-timeline.service';

/**
 * The Ticket Engine — the generic operational core. Category carries business
 * context; status transitions live in TicketStatusService; every action is
 * recorded on the structured timeline and published as a domain event for
 * future notification modules to consume.
 */
@Module({
  controllers: [
    TicketController,
    TicketCommentController,
    TicketAttachmentController,
    TicketCategoryController,
  ],
  providers: [
    TicketService,
    TicketStatusService,
    TicketTimelineService,
    TicketCategoryService,
    TicketCommentService,
    TicketAttachmentService,
    TicketDashboardService,
  ],
  exports: [TicketService, TicketStatusService],
})
export class TicketModule {}
