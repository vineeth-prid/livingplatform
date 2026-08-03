import { Module } from '@nestjs/common';

import { CommunityInsightsService } from './community-insights.service';
import { PlatformBusinessService } from './platform-business.service';
import {
  CommunityInsightsController,
  PlatformStatsController,
} from './platform-stats.controller';
import { PlatformStatsService } from './platform-stats.service';

/**
 * Analytics — the platform's read models. Executive aggregates, audit log and
 * system info (Sprint 10), plus business intelligence at two scopes (Sprint 12):
 * `PlatformBusinessService` aggregates across communities and deliberately
 * exposes no per-community money, while `CommunityInsightsService` is
 * tenant-scoped and answers only for the caller's own community.
 */
@Module({
  controllers: [PlatformStatsController, CommunityInsightsController],
  providers: [PlatformStatsService, PlatformBusinessService, CommunityInsightsService],
  exports: [PlatformBusinessService, CommunityInsightsService],
})
export class PlatformStatsModule {}
