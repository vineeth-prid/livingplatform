import { Global, Module } from '@nestjs/common';

import { CommunityModulesService } from './community-modules.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Global because "is this module enabled for this community?" is asked by
 * billing, payments, packages, the dashboards, a global guard and a cron job.
 * Making it global keeps that ONE answer authoritative instead of each module
 * importing (or worse, re-deriving) it.
 *
 * Two services, deliberately:
 *   • `CommunityModulesService` — SINGLETON, PrismaService only. Safe to inject
 *     into global guards and `@Cron` handlers.
 *   • `SettingsService` — request-scoped (it needs tenant context for settings
 *     CRUD) and delegates the toggle reads to the singleton.
 */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [CommunityModulesService, SettingsService],
  exports: [CommunityModulesService, SettingsService],
})
export class SettingsModule {}
