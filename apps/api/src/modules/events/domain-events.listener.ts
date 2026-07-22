import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AuditService } from '../audit/audit.service';
import type { DomainEvent } from './domain-events';

/**
 * Template listener demonstrating the consumption seam. Today it mirrors every
 * domain event into the audit trail (semantic events, distinct from the raw
 * HTTP audit the interceptor records). Future modules add their own focused
 * @OnEvent handlers (notifications, projections, cache busting, …) — or this
 * moves behind an outbox relay for guaranteed async delivery.
 */
@Injectable()
export class DomainEventsListener {
  private readonly logger = new Logger(DomainEventsListener.name);

  constructor(private readonly audit: AuditService) {}

  @OnEvent('**', { async: true })
  async onAnyDomainEvent(event: DomainEvent): Promise<void> {
    this.logger.debug(`handle ${event.name} (${event.entityId})`);
    const [resource] = event.name.split('.');
    await this.audit.record({
      action: event.name,
      resource: resource ?? 'domain',
      resourceId: event.entityId,
      actorId: event.actorId,
      tenantId: event.tenantId,
      communityId: event.communityId,
      metadata: { source: 'domain-event', data: event.data },
    });
  }
}
