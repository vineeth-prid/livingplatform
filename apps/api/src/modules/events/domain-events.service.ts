import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { DomainEvent } from './domain-events';

type PublishInput<T extends DomainEvent> = Omit<T, 'occurredAt'> & {
  occurredAt?: Date;
};

/**
 * The single seam every module publishes domain events through. Wrapping
 * EventEmitter2 (instead of injecting it directly) means the transport can be
 * swapped for an outbox/broker later without touching call sites.
 */
@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  publish<T extends DomainEvent>(event: PublishInput<T>): void {
    const enriched = { occurredAt: new Date(), ...event } as DomainEvent;
    this.logger.debug(`emit ${enriched.name} (${enriched.entityId})`);
    // Fire-and-forget; listeners must not break the emitting request.
    this.emitter.emit(enriched.name, enriched);
  }

  /** Convenience builder that pulls tenant/actor context from the principal. */
  from(
    actor: AuthenticatedUser | undefined,
    communityId: string | null,
  ): { tenantId: string | null; communityId: string | null; actorId: string | null } {
    return {
      tenantId: actor?.tenantId ?? null,
      communityId,
      actorId: actor?.id ?? null,
    };
  }
}
