import { randomInt } from 'node:crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationTokenType } from '@prisma/client';
import * as argon2 from 'argon2';

import { expiryFrom } from '../../common/utils/duration';
import type { AppConfig } from '../../config/configuration';
import { NOTIFICATION_TEMPLATES } from '../notifications/notification.constants';
import { NotificationDispatcher } from '../notifications/core/notification.dispatcher';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const MAX_ATTEMPTS = 5;

/**
 * One-time passcodes for mobile-number password reset.
 *
 * The code is hashed (argon2) into the existing VerificationToken table —
 * PASSWORD_RESET type, no new model — and delivered through the Notification
 * Engine, so it rides the same WhatsApp/email channels, queue and tracking as
 * everything else. Wrong-code attempts are counted in Redis and the code is
 * burned after MAX_ATTEMPTS, which is what makes a 6-digit code safe.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly ttl: string;
  private readonly length: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationDispatcher,
    config: ConfigService<AppConfig, true>,
  ) {
    const auth = config.get('auth', { infer: true });
    this.ttl = auth.otpTtl;
    this.length = Math.min(Math.max(4, auth.otpLength), 8);
  }

  /**
   * Issue a code for a user and deliver it. `channels` reflects what the user
   * actually has — WhatsApp when a mobile is known, email otherwise/as well.
   * Never reveals whether delivery succeeded (the caller returns a generic
   * message either way).
   */
  async issue(user: {
    id: string;
    email: string;
    firstName: string;
    mobile?: string | null;
  }): Promise<void> {
    // Invalidate outstanding codes first — one live code per user.
    await this.prisma.verificationToken.updateMany({
      where: { userId: user.id, type: VerificationTokenType.PASSWORD_RESET, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = this.generate();
    const tokenHash = await argon2.hash(code, { type: argon2.argon2id });
    const row = await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: VerificationTokenType.PASSWORD_RESET,
        tokenHash,
        expiresAt: expiryFrom(this.ttl),
      },
      select: { id: true },
    });
    await this.redis.del(this.attemptsKey(row.id)).catch(() => undefined);

    const variables = { code, name: user.firstName, minutes: this.ttl };
    if (user.mobile) {
      await this.deliver('whatsapp', user.mobile, variables);
    }
    if (user.email && !user.email.endsWith('@living.local')) {
      // Provisioned people accounts get a synthetic @living.local address —
      // mailing it is pointless, so WhatsApp is the only real channel there.
      await this.deliver('email', user.email, variables);
    }
  }

  /**
   * Verify a code. Returns the userId on success. Wrong codes increment an
   * attempt counter and burn the token once it is exhausted.
   */
  async verify(userId: string, code: string): Promise<string> {
    const row = await this.prisma.verificationToken.findFirst({
      where: { userId, type: VerificationTokenType.PASSWORD_RESET, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('That code is invalid or has expired');
    }

    const ok = await argon2.verify(row.tokenHash, code).catch(() => false);
    if (!ok) {
      const attempts = await this.bumpAttempts(row.id);
      if (attempts >= MAX_ATTEMPTS) {
        await this.prisma.verificationToken.update({
          where: { id: row.id },
          data: { consumedAt: new Date() },
        });
        this.logger.warn(`OTP burned after ${MAX_ATTEMPTS} failed attempts (user=${userId})`);
      }
      throw new BadRequestException('That code is invalid or has expired');
    }

    await this.prisma.verificationToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    await this.redis.del(this.attemptsKey(row.id)).catch(() => undefined);
    return row.userId;
  }

  private generate(): string {
    const max = 10 ** this.length;
    return String(randomInt(0, max)).padStart(this.length, '0');
  }

  private async bumpAttempts(tokenId: string): Promise<number> {
    try {
      const key = this.attemptsKey(tokenId);
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, 900);
      return n;
    } catch {
      // Redis down → fail closed on the strict side: treat as the last attempt
      // so a brute-force cannot ride an outage.
      return MAX_ATTEMPTS;
    }
  }

  private attemptsKey(tokenId: string): string {
    return `auth:otp:attempts:${tokenId}`;
  }

  private async deliver(
    channel: 'email' | 'whatsapp',
    to: string,
    variables: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.notifications.dispatchTemplate(
        channel,
        NOTIFICATION_TEMPLATES.OTP_REQUESTED,
        to,
        variables,
      );
    } catch (err) {
      // Delivery failure must not leak through the generic response.
      this.logger.error(`Failed to queue OTP on ${channel}`, err as Error);
    }
  }
}
