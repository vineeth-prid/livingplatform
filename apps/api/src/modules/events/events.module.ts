import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { DomainEventsListener } from './domain-events.listener';
import { DomainEventsService } from './domain-events.service';

/**
 * Global domain-events infrastructure. `wildcard: true` lets listeners subscribe
 * to namespaced patterns (e.g. `community.*` or `**`).
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      ignoreErrors: true, // a failing listener must never break the emitter
    }),
  ],
  providers: [DomainEventsService, DomainEventsListener],
  exports: [DomainEventsService],
})
export class EventsModule {}
