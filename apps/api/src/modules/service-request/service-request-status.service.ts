import { BadRequestException, Injectable } from '@nestjs/common';
import { ServiceRequestStatus } from '@prisma/client';

/**
 * Authority on service-request status transitions (same pattern as
 * TicketStatusService — never hardcode transitions in controllers).
 *
 *   REQUESTED → ASSIGNED → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED
 *   (+ CANCELLED / REJECTED exits)
 */
@Injectable()
export class ServiceRequestStatusService {
  private readonly transitions: Readonly<
    Record<ServiceRequestStatus, ServiceRequestStatus[]>
  > = {
    [ServiceRequestStatus.REQUESTED]: [
      ServiceRequestStatus.ASSIGNED,
      ServiceRequestStatus.CANCELLED,
      ServiceRequestStatus.REJECTED,
    ],
    [ServiceRequestStatus.ASSIGNED]: [
      ServiceRequestStatus.ACCEPTED,
      ServiceRequestStatus.REJECTED,
      ServiceRequestStatus.CANCELLED,
      ServiceRequestStatus.REQUESTED, // unassign
    ],
    [ServiceRequestStatus.ACCEPTED]: [
      ServiceRequestStatus.SCHEDULED,
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.CANCELLED,
    ],
    [ServiceRequestStatus.SCHEDULED]: [
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.CANCELLED,
    ],
    [ServiceRequestStatus.IN_PROGRESS]: [
      ServiceRequestStatus.COMPLETED,
      ServiceRequestStatus.CANCELLED,
    ],
    [ServiceRequestStatus.COMPLETED]: [], // terminal
    [ServiceRequestStatus.CANCELLED]: [], // terminal
    [ServiceRequestStatus.REJECTED]: [], // terminal
  };

  canTransition(from: ServiceRequestStatus, to: ServiceRequestStatus): boolean {
    if (from === to) return false;
    return this.transitions[from].includes(to);
  }

  assertTransition(from: ServiceRequestStatus, to: ServiceRequestStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} → ${to}. Allowed: ${
          this.transitions[from].join(', ') || '(none — terminal)'
        }`,
      );
    }
  }

  allowedNext(from: ServiceRequestStatus): ServiceRequestStatus[] {
    return [...this.transitions[from]];
  }

  isTerminal(status: ServiceRequestStatus): boolean {
    return this.transitions[status].length === 0;
  }
}
