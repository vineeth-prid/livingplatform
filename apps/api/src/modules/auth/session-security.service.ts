import { createHash } from 'node:crypto';

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import { durationToMs } from '../../common/utils/duration';
import { RedisService } from '../redis/redis.service';

/**
 * Redis-backed account protections that live outside the database:
 *
 *  - Per-ACCOUNT login lockout. The IP throttle alone does nothing against a
 *    credential-stuffing botnet spread over many addresses.
 *  - "Sessions revoked after T" marker per user, checked by JwtStrategy, so a
 *    suspended user or a changed password kills live ACCESS tokens too — not
 *    just refresh tokens 15 minutes later.
 *  - One-use TOTP codes (a sniffed code cannot be replayed inside its window).
 *
 * Availability over strictness: when Redis is down, lockout and revocation
 * checks are skipped (logged) rather than locking everybody out of the
 * platform. The OTP attempt counter, which guards a 6-digit secret, keeps its
 * own fail-closed behaviour in OtpService.
 */
@Injectable()
export class SessionSecurityService {
  private readonly logger = new Logger(SessionSecurityService.name);
  private readonly maxFailures: number;
  private readonly lockoutSeconds: number;
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<AppConfig, true>,
  ) {
    const auth = config.get('auth', { infer: true });
    this.maxFailures = auth.loginMaxFailures;
    this.lockoutSeconds = Math.ceil(durationToMs(auth.loginLockout) / 1000);
    this.accessTtlSeconds = Math.ceil(durationToMs(auth.accessTtl) / 1000);
  }

  private get ready(): boolean {
    return this.redis.status === 'ready';
  }

  // ── login lockout ─────────────────────────────────────────────────────────

  /** Keyed on the typed identifier (hashed), so unknown accounts behave identically. */
  private failKey(identifier: string): string {
    const h = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex');
    return `auth:login-fail:${h}`;
  }

  async assertNotLocked(identifier: string): Promise<void> {
    if (!this.ready || this.maxFailures <= 0) return;
    try {
      const count = Number(await this.redis.get(this.failKey(identifier)));
      if (count >= this.maxFailures) {
        throw new HttpException(
          `Too many failed sign-in attempts. Try again in ${Math.ceil(this.lockoutSeconds / 60)} minutes, or reset your password.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.warn(`Lockout check skipped: ${(err as Error).message}`);
    }
  }

  /** Returns the running failure count (0 when Redis is unavailable). */
  async recordFailure(identifier: string): Promise<number> {
    if (!this.ready || this.maxFailures <= 0) return 0;
    try {
      const key = this.failKey(identifier);
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, this.lockoutSeconds);
      return count;
    } catch (err) {
      this.logger.warn(`Could not record login failure: ${(err as Error).message}`);
      return 0;
    }
  }

  async clearFailures(identifier: string): Promise<void> {
    if (!this.ready) return;
    await this.redis.del(this.failKey(identifier)).catch(() => undefined);
  }

  // ── access-token revocation ───────────────────────────────────────────────

  private revokedKey(userId: string): string {
    return `auth:revoked-after:${userId}`;
  }

  /**
   * Every access token for this user issued before now stops working. The key
   * only has to outlive the longest access token, so it expires on its own.
   */
  async revokeSessions(userId: string): Promise<void> {
    if (!this.ready) {
      this.logger.warn(`Redis unavailable — live access tokens for ${userId} expire naturally`);
      return;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    await this.redis
      .set(this.revokedKey(userId), String(nowSec), 'EX', this.accessTtlSeconds + 60)
      .catch((err: Error) => this.logger.warn(`Could not record session revocation: ${err.message}`));
  }

  /** True when the token (by its `iat`) predates a revocation for this user. */
  async isRevoked(userId: string, issuedAtSec: number | undefined): Promise<boolean> {
    if (!this.ready || issuedAtSec === undefined) return false;
    try {
      const after = await this.redis.get(this.revokedKey(userId));
      return after !== null && issuedAtSec < Number(after);
    } catch {
      return false;
    }
  }

  // ── TOTP replay ───────────────────────────────────────────────────────────

  /** Claims a TOTP time step for a user; false if that code was already used. */
  async claimTotpStep(userId: string, step: number): Promise<boolean> {
    if (!this.ready) return true;
    try {
      const ok = await this.redis.set(`auth:totp-used:${userId}:${step}`, '1', 'EX', 120, 'NX');
      return ok === 'OK';
    } catch {
      return true;
    }
  }
}
