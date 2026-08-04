import { Global, Module } from '@nestjs/common';

import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';

/**
 * Realtime delivery (SSE). Global so any business module can inject
 * RealtimeService to push an update without importing this module — the same
 * shape as the Notification Engine, and for the same reason.
 *
 * This module ADDS a transport; it changes nothing about how existing modules
 * respond to requests. Every feature that uses it must keep working with the
 * stream disconnected (clients fall back to polling).
 */
@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
