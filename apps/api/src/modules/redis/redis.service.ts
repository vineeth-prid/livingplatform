import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Shared Redis connection. Wired for foundation use (health readiness, and
 * ready for caching / rate-limit storage / token denylists as modules need it).
 *
 * ponytail: connects lazily so a Redis outage doesn't block API boot — the
 * readiness probe surfaces it instead. Nothing on the request hot path depends
 * on Redis yet.
 */
@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(config: ConfigService) {
    super(config.getOrThrow<string>('redis.url'), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
      this.logger.log('Redis connection established');
    } catch (err) {
      this.logger.warn(
        `Redis not reachable at boot — continuing (readiness will report it): ${
          (err as Error).message
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.disconnect();
  }
}
