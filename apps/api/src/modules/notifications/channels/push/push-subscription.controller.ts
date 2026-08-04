import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AppConfig } from '../../../../config/configuration';
import { PrismaService } from '../../../prisma/prisma.service';

export class RegisterPushSubscriptionDto {
  @ApiProperty({ description: 'PushSubscription.endpoint from the browser' })
  @IsString() @MinLength(10) @MaxLength(2000)
  endpoint!: string;

  @ApiProperty({ description: "Base64url of getKey('p256dh')" })
  @IsString() @MinLength(10) @MaxLength(512)
  p256dh!: string;

  @ApiProperty({ description: "Base64url of getKey('auth')" })
  @IsString() @MinLength(4) @MaxLength(512)
  auth!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(400) userAgent?: string;
}

/**
 * Device registration for Web Push. Self-service — a user manages only their
 * OWN devices, so these routes carry no RBAC permission (same posture as
 * /profile/me). Nothing here is community-scoped: a push device belongs to a
 * person, not a community.
 */
@ApiTags('Push Notifications')
@ApiBearerAuth()
@Controller('push')
export class PushSubscriptionController {
  private readonly publicKey: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.publicKey = config.get('push', { infer: true }).publicKey;
  }

  /**
   * The VAPID public key the browser needs to create a subscription, plus
   * whether push is configured at all — the client uses `enabled` to decide
   * between offering the toggle and explaining that push is unavailable.
   */
  @Get('public-key')
  @ApiOperation({ summary: 'VAPID public key for browser subscription' })
  publicKeyForClient(): { publicKey: string | null; enabled: boolean } {
    return { publicKey: this.publicKey || null, enabled: Boolean(this.publicKey) };
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Register (or refresh) this device for push' })
  async subscribe(
    @Body() dto: RegisterPushSubscriptionDto,
    @CurrentUser('id') userId: string,
  ): Promise<{ id: string; registered: true }> {
    // Endpoint is globally unique: re-subscribing on the same device, or a
    // device changing hands, re-points the existing row at the current user.
    const row = await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
        userAgent: dto.userAgent,
      },
      update: {
        userId,
        p256dh: dto.p256dh,
        auth: dto.auth,
        userAgent: dto.userAgent,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });
    return { id: row.id, registered: true };
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'My registered push devices' })
  list(@CurrentUser('id') userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  @Delete('subscriptions')
  @ApiOperation({ summary: 'Unregister this device (by endpoint)' })
  async unsubscribe(
    @Query('endpoint') endpoint: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ deleted: number }> {
    // Scoped to the caller so an endpoint string cannot delete someone else's.
    const { count } = await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
    return { deleted: count };
  }
}
