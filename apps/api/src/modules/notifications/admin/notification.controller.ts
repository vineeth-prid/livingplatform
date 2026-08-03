import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import type { AppConfig } from '../../../config/configuration';
import { PERMISSIONS } from '../../rbac/rbac.constants';
import { ChannelRouter } from '../core/channel-router';
import { NotificationDispatcher } from '../core/notification.dispatcher';
import { NotificationHistory } from '../core/notification-history.service';
import { NotificationMetrics } from '../core/notification-metrics.service';
import { EmailTemplateEngine } from '../core/templates/template.engine';
import { EmailChannel } from '../channels/email/email.channel';
import { WhatsAppSessionService } from '../channels/whatsapp/whatsapp-session.service';
import {
  DeliveriesQueryDto, SendTestEmailDto, SendTestWhatsAppDto, SetProviderDto,
  SetSessionApiKeyDto, StatisticsQueryDto,
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
    private readonly sessions: WhatsAppSessionService,
    private readonly engine: EmailTemplateEngine,
    private readonly config: ConfigService<AppConfig, true>,
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

  // ── WhatsApp gateway settings (OpenWA) ──
  // Platform configuration ONLY — no message can be sent from these routes
  // except the explicitly diagnostic /whatsapp/test above.

  @Get('whatsapp/settings')
  @RequirePermissions(PERMISSIONS.WHATSAPP_ADMIN)
  @ApiOperation({ summary: 'Active WhatsApp provider, sender and rate limits' })
  whatsappSettings() {
    const wa = this.config.get('whatsapp', { infer: true });
    return {
      provider: wa.provider,
      supported: ['meta', 'openwa'],
      rateLimitPerMinute: wa.rateLimitPerMinute,
      defaultSender: wa.provider === 'openwa' ? wa.openwa.session : wa.meta.phoneNumberId,
      openwa: {
        // The API key and webhook secret are deliberately absent.
        baseUrl: wa.openwa.baseUrl,
        session: wa.openwa.session,
        autoReconnect: wa.openwa.autoReconnect,
        healthIntervalSec: wa.openwa.healthIntervalSec,
        webhookConfigured: Boolean(wa.openwa.webhookSecret),
        webhookUrl: wa.openwa.webhookUrl || null,
      },
    };
  }

  @Get('whatsapp/sessions')
  @RequirePermissions(PERMISSIONS.WHATSAPP_ADMIN)
  @ApiOperation({ summary: 'Gateway sessions and their connection status' })
  whatsappSessions() {
    return this.sessions.list();
  }

  @Get('whatsapp/sessions/:name')
  @RequirePermissions(PERMISSIONS.WHATSAPP_ADMIN)
  @ApiOperation({ summary: 'Live status of one session (polls the gateway)' })
  whatsappSession(@Param('name') name: string) {
    return this.sessions.status(name);
  }

  @Get('whatsapp/sessions/:name/qr')
  @RequirePermissions(PERMISSIONS.WHATSAPP_ADMIN)
  @ApiOperation({ summary: 'QR payload to pair the session (null once connected)' })
  whatsappQr(@Param('name') name: string) {
    return this.sessions.qr(name);
  }

  @Post('whatsapp/sessions/:name/connect')
  @RequirePermissions(PERMISSIONS.WHATSAPP_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create + start the session and begin QR pairing' })
  whatsappConnect(@Param('name') name: string, @CurrentUser('id') actorId: string) {
    return this.sessions.connect(name, actorId);
  }

  @Post('whatsapp/sessions/:name/reconnect')
  @RequirePermissions(PERMISSIONS.WHATSAPP_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restart the session without clearing its pairing' })
  whatsappReconnect(@Param('name') name: string, @CurrentUser('id') actorId: string) {
    return this.sessions.reconnect(name, actorId);
  }

  @Post('whatsapp/sessions/:name/disconnect')
  @RequirePermissions(PERMISSIONS.WHATSAPP_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log the session out (a new QR scan is then required)' })
  whatsappDisconnect(@Param('name') name: string, @CurrentUser('id') actorId: string) {
    return this.sessions.disconnect(name, actorId);
  }

  @Put('whatsapp/sessions/:name/api-key')
  @RequirePermissions(PERMISSIONS.WHATSAPP_ADMIN)
  @ApiOperation({ summary: 'Store a session-scoped gateway API key (encrypted at rest)' })
  whatsappApiKey(
    @Param('name') name: string,
    @Body() dto: SetSessionApiKeyDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.sessions.setApiKey(name, dto.apiKey, actorId);
  }

  // ── Queue + templates (read-only platform views) ──

  @Get('queue')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Shared notification queue depth and failure counts' })
  async queue() {
    const stats = await this.metrics.statistics(24);
    return { ...stats.queue, retrying: stats.retrying, deadLettered: stats.deadLettered };
  }

  @Get('templates')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Platform default templates available to every community' })
  templates() {
    return this.engine.list().map((name) => ({ name, source: 'platform' as const }));
  }
}
