import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { AnnouncementService } from './announcement.service';
import { BookingService } from './booking.service';
import { VisitorService } from './visitor.service';
import {
  CreateAnnouncementDto, QueryAnnouncementDto, UpdateAnnouncementDto,
} from './dto/announcement.dto';
import {
  CancelBookingDto, CreateBookingDto, QueryBookingDto, UpdateBookingDto,
} from './dto/booking.dto';
import {
  CreateVisitorDto, QueryVisitorDto, RejectVisitorDto, UpdateVisitorDto,
} from './dto/visitor.dto';

@ApiTags('Visitors')
@ApiBearerAuth()
@Controller('visitors')
export class VisitorController {
  constructor(private readonly visitors: VisitorService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VISITOR_READ)
  @ApiOperation({ summary: 'List visitors (residents see only their own)' })
  list(@Query() query: QueryVisitorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.findMany(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VISITOR_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.VISITOR_CREATE)
  @ApiOperation({ summary: 'Invite a visitor (generates a unique gate pass code)' })
  create(@Body() dto: CreateVisitorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VISITOR_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateVisitorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.VISITOR_UPDATE)
  @ApiOperation({ summary: 'Cancel a visit (soft-delete)' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.cancel(id, user);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.VISITOR_APPROVE)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.approve(id, user);
  }

  @Post(':id/reject')
  @RequirePermissions(PERMISSIONS.VISITOR_APPROVE)
  reject(@Param('id') id: string, @Body() dto: RejectVisitorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.reject(id, dto, user);
  }

  @Post(':id/checkin')
  @RequirePermissions(PERMISSIONS.VISITOR_CHECKIN)
  checkIn(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.checkIn(id, user);
  }

  @Post(':id/checkout')
  @RequirePermissions(PERMISSIONS.VISITOR_CHECKOUT)
  checkOut(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.visitors.checkOut(id, user);
  }
}

@ApiTags('Amenity Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'List bookings (residents see only their own)' })
  list(@Query() query: QueryBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.findMany(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BOOKING_CREATE)
  @ApiOperation({ summary: 'Book an amenity slot (validates conflicts, hours, window, capacity)' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Update a booking status/remarks (managers)' })
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.update(id, dto, user);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.BOOKING_CANCEL)
  @ApiOperation({ summary: 'Cancel a booking' })
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.cancel(id, dto, user);
  }
}

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENT_READ)
  @ApiOperation({ summary: 'List announcements (residents see only currently-visible)' })
  list(@Query() query: QueryAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.findMany(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENT_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENT_CREATE)
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENT_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENT_UPDATE)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.remove(id, user);
  }

  @Post(':id/publish')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENT_PUBLISH)
  @ApiOperation({ summary: 'Publish an announcement now' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.publish(id, user);
  }

  @Post(':id/expire')
  @RequirePermissions(PERMISSIONS.ANNOUNCEMENT_PUBLISH)
  @ApiOperation({ summary: 'Expire an announcement now' })
  expire(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.expire(id, user);
  }
}
