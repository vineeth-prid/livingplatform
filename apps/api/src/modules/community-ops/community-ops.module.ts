import { Module } from '@nestjs/common';

import { AnnouncementSchedulerService } from './announcement-scheduler.service';
import { AnnouncementService } from './announcement.service';
import { BookingService } from './booking.service';
import {
  AnnouncementController, BookingController, VisitorController,
} from './community-ops.controllers';
import { VisitorService } from './visitor.service';

/**
 * Community Operations (Sprint 10) — the resident-facing operational layer:
 * visitor management, amenity bookings and announcements. Amenities and community
 * documents are REUSED from the Community Foundation (Sprint 2) — this bounded
 * context adds no rival models for them; the Booking engine reads the existing
 * Amenity's config. Reuses the platform's tenancy, events, audit, RBAC and the
 * shared cron registry (an hourly announcement lifecycle sweep).
 */
@Module({
  controllers: [VisitorController, BookingController, AnnouncementController],
  providers: [
    VisitorService,
    BookingService,
    AnnouncementService,
    AnnouncementSchedulerService,
  ],
  exports: [VisitorService, BookingService, AnnouncementService],
})
export class CommunityOpsModule {}
