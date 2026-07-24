import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../rbac/rbac.constants';
import { ChannelRouter } from '../core/channel-router';
import { NotificationDispatcher } from '../core/notification.dispatcher';
import { NotificationHistory } from '../core/notification-history.service';
import { NotificationMetrics } from '../core/notification-metrics.service';
import { EmailChannel } from '../channels/email/email.channel';
import {
  DeliveriesQueryDto, SendTestEmailDto, SendTestWhatsAppDto, SetProviderDto, StatisticsQueryDto,
} from './dto/notification-admin.dto';

/**
 * Platform-Admin controls for the Notification Engine. Gated on COMMUNITY_CREATE
 * (platform-only). The `/notifications/email/*` routes are preserved verbatim
 * from the Email sprint so the existing SDK + portal page keep working; new
 * channel-agnostic and WhatsApp routes sit alongside.
 */
@ApiTags('Notifications · Admin')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly router: ChannelRouter,
    private readonly dispatcher: NotificationDispatcher,
    private readonly metrics: NotificationMetrics,
    private readonly history: NotificationHistory,
    private readonly email: EmailChannel,
  ) {}

  // ── Channels (cross-channel) ──
  @Get('channels')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'List channels with live health' })
  async channels() {
    const health = await this.router.health();
    return this.router.list().map((c) => ({
      channel: c.channel,
      provider: c.provider,
      health: health.find((h) => h.channel === c.channel) ?? null,
    }));
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Delivery statistics across all channels (or one)' })
  statistics(@Query() query: StatisticsQueryDto) {
    return this.metrics.statistics(query.windowHours, query.channel);
  }

  @Get('deliveries')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Notification history / search' })
  deliveries(@Query() query: DeliveriesQueryDto) {
    return this.history.search(query);
  }

  // ── Email channel (routes preserved from the Email sprint) ──
  @Get('email/provider')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Active email provider' })
  emailProvider() {
    return {
      active: this.email.provider,
      configured: this.email.configuredProvider,
      overridden: this.email.isOverridden,
      supported: ['ses', 'smtp'],
    };
  }

  @Put('email/provider')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Switch the email provider at runtime (ops failover)' })
  async setEmailProvider(@Body() dto: SetProviderDto) {
    const p = await this.email.switchProvider(dto.provider);
    return { active: p.name, configured: this.email.configuredProvider, overridden: this.email.isOverridden };
  }

  @Get('email/health')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Health of the active email provider' })
  emailHealth() {
    return this.dispatcher.health('email');
  }

  @Post('email/test')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  // Sends from the platform's verified identity to an arbitrary address — cap it
  // hard so a compromised/rogue admin can't use it as a spam/harassment relay.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test email' })
  async emailTest(@Body() dto: SendTestEmailDto) {
    const r = await this.dispatcher.dispatchTest('email', dto.to);
    return { sent: true, provider: r.provider, messageId: r.messageId };
  }

  @Get('email/statistics')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Email delivery statistics' })
  emailStatistics(@Query() query: StatisticsQueryDto) {
    return this.metrics.statistics(query.windowHours, 'email');
  }

  // ── WhatsApp channel ──
  @Get('whatsapp/health')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Health of the WhatsApp channel' })
  whatsappHealth() {
    return this.dispatcher.health('whatsapp');
  }

  @Post('whatsapp/test')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test WhatsApp message' })
  async whatsappTest(@Body() dto: SendTestWhatsAppDto) {
    const r = await this.dispatcher.dispatchTest('whatsapp', dto.to);
    return { sent: true, provider: r.provider, messageId: r.messageId };
  }

  @Get('whatsapp/statistics')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'WhatsApp delivery statistics' })
  whatsappStatistics(@Query() query: StatisticsQueryDto) {
    return this.metrics.statistics(query.windowHours, 'whatsapp');
  }
}
