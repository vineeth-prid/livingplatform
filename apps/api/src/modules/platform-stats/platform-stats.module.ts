import { Module } from '@nestjs/common';

import { PlatformStatsController } from './platform-stats.controller';
import { PlatformStatsService } from './platform-stats.service';

/** Platform Admin analytics — executive aggregates, audit log, system info. */
@Module({
  controllers: [PlatformStatsController],
  providers: [PlatformStatsService],
})
export class PlatformStatsModule {}
