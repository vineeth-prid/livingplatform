import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import {
  PrismaHealthIndicator,
  RedisHealthIndicator,
  StorageHealthIndicator,
} from './health.indicators';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, MetricsController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator, StorageHealthIndicator],
})
export class HealthModule {}
