import { Global, Module } from '@nestjs/common';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Global because SettingsService now answers "is this module enabled for this
 * community?" — a question the billing, payments and packages modules all ask.
 * Making it global keeps that ONE answer authoritative instead of each module
 * importing (or worse, re-deriving) it.
 */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
