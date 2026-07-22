import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  type HealthIndicatorResult,
} from '@nestjs/terminus';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** Readiness check: can we reach Postgres? */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'Database unreachable',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}

/** Readiness check: can we reach Redis? */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      return this.getStatus(key, pong === 'PONG');
    } catch (err) {
      throw new HealthCheckError(
        'Redis unreachable',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
