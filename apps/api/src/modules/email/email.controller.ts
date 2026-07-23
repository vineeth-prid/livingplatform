import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../rbac/rbac.constants';
import { SendTestEmailDto, SetProviderDto, StatisticsQueryDto } from './dto/email.dto';
import { EmailMetricsService } from './email.metrics.service';
import { EmailProviderRegistry } from './email-provider.registry';
import { EmailService } from './email.service';

/**
 * Platform Admin controls for the Email Service. Gated on COMMUNITY_CREATE — a
 * permission only the Platform Admin holds — so associations/facility managers
 * cannot reach it. Business modules use EmailService directly, never this.
 */
@ApiTags('Notifications · Email')
@ApiBearerAuth()
@Controller('notifications/email')
export class EmailController {
  constructor(
    private readonly email: EmailService,
    private readonly registry: EmailProviderRegistry,
    private readonly metrics: EmailMetricsService,
  ) {}

  @Get('provider')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Active email provider' })
  provider() {
    return {
      active: this.registry.current.name,
      configured: this.registry.configured,
      overridden: this.registry.isOverridden,
      supported: ['ses', 'smtp'],
    };
  }

  @Put('provider')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Switch the active provider at runtime (ops failover)' })
  async setProvider(@Body() dto: SetProviderDto) {
    const provider = await this.registry.switchTo(dto.provider);
    return { active: provider.name, configured: this.registry.configured, overridden: this.registry.isOverridden };
  }

  @Get('health')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Health of the active provider (connection/auth/send)' })
  health() {
    return this.email.health();
  }

  @Post('test')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test email through the active provider' })
  async test(@Body() dto: SendTestEmailDto) {
    const result = await this.email.sendTest(dto.to);
    return { sent: true, provider: result.provider, messageId: result.messageId };
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.COMMUNITY_CREATE)
  @ApiOperation({ summary: 'Email delivery metrics for Platform Admin' })
  statistics(@Query() query: StatisticsQueryDto) {
    return this.metrics.statistics(query.windowHours);
  }
}
