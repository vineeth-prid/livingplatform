import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import {
  PrismaHealthIndicator,
  RedisHealthIndicator,
} from './health.indicators';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, MetricsController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
