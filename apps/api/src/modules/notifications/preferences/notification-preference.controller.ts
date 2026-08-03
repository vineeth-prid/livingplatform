import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationEvent } from '@prisma/client';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { PERMISSIONS } from '../../rbac/rbac.constants';
import {
  UpdateNotificationPreferenceDto,
  UpsertNotificationTemplateDto,
} from './dto/notification-preference.dto';
import { NotificationPreferenceService } from './notification-preference.service';

/**
 * Community Admin: which events go out, on which channels, with which wording.
 * Sending is NOT possible from here — this is configuration only; the engine
 * still owns every delivery.
 */
@ApiTags('Notifications · Community Preferences')
@ApiBearerAuth()
@Controller('communities/:communityId/notification-preferences')
export class NotificationPreferenceController {
  constructor(private readonly preferences: NotificationPreferenceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATION_PREFERENCE_READ)
  @ApiOperation({ summary: 'Every event with its effective channel routing' })
  list(@Param('communityId') communityId: string) {
    return this.preferences.list(communityId);
  }

  @Put(':event')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_PREFERENCE_UPDATE)
  @ApiOperation({ summary: 'Enable/disable an event per channel (email, whatsapp, both)' })
  update(
    @Param('communityId') communityId: string,
    @Param('event') event: NotificationEvent,
    @Body() dto: UpdateNotificationPreferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.preferences.update(communityId, event, dto, user);
  }
}

@ApiTags('Notifications · Community Preferences')
@ApiBearerAuth()
@Controller('communities/:communityId/notification-templates')
export class NotificationTemplateController {
  constructor(private readonly preferences: NotificationPreferenceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATION_TEMPLATE_READ)
  @ApiOperation({ summary: 'Message templates this community has overridden' })
  list(@Param('communityId') communityId: string) {
    return this.preferences.listTemplates(communityId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)
  @ApiOperation({ summary: 'Write the message body for an event on a channel' })
  upsert(
    @Param('communityId') communityId: string,
    @Body() dto: UpsertNotificationTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.preferences.upsertTemplate(communityId, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)
  @ApiOperation({ summary: 'Drop an override and fall back to the platform default' })
  remove(@Param('communityId') communityId: string, @Param('id') id: string) {
    return this.preferences.removeTemplate(communityId, id);
  }
}
