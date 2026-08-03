import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Password policy: hashing, reuse prevention and the history ledger.
 *
 * Every path that sets a password (first-login change, self-service reset,
 * admin reset) goes through `hashAndRecord`, so history can never be bypassed
 * by adding a new flow later. History depth is configurable
 * (AUTH_PASSWORD_HISTORY_SIZE); 0 disables the check without removing the code.
 */
@Injectable()
export class PasswordPolicyService {
  private readonly historySize: number;
  private readonly minLength: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    const auth = config.get('auth', { infer: true });
    this.historySize = Math.max(0, auth.passwordHistorySize);
    this.minLength = auth.passwordMinLength;
  }

  /** The one-time password handed to newly provisioned accounts. */
  static defaultPasswordFrom(config: ConfigService<AppConfig, true>): string {
    return config.get('auth', { infer: true }).defaultPassword;
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false);
  }

  /**
   * Set a user's password after checking it against their recent history, then
   * append the OLD hash to history and trim. Returns the new hash so callers
   * can write it in their own transaction/update.
   */
  async hashAndRecord(userId: string, newPassword: string): Promise<string> {
    if (newPassword.length < this.minLength) {
      throw new BadRequestException(`Password must be at least ${this.minLength} characters`);
    }
    await this.assertNotReused(userId, newPassword);

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const hash = await this.hash(newPassword);

    if (this.historySize > 0 && current?.passwordHash) {
      await this.prisma.passwordHistory.create({
        data: { userId, passwordHash: current.passwordHash },
      });
      await this.trim(userId);
    }
    return hash;
  }

  /** Throws when the candidate matches the current password or recent history. */
  private async assertNotReused(userId: string, candidate: string): Promise<void> {
    if (this.historySize === 0) return;
    const [user, history] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
      this.prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: this.historySize,
        select: { passwordHash: true },
      }),
    ]);
    const hashes = [user?.passwordHash, ...history.map((h) => h.passwordHash)].filter(
      (h): h is string => Boolean(h),
    );
    for (const hash of hashes) {
      if (await this.verify(hash, candidate)) {
        throw new BadRequestException(
          `Choose a password you have not used in your last ${this.historySize} passwords`,
        );
      }
    }
  }

  /** Keep only the newest `historySize` entries. */
  private async trim(userId: string): Promise<void> {
    const rows = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: this.historySize,
      select: { id: true },
    });
    if (rows.length === 0) return;
    await this.prisma.passwordHistory.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  }
}
