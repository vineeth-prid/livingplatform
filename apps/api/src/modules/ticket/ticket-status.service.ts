import { BadRequestException, Injectable } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

/**
 * The single authority on ticket status transitions. Controllers and services
 * MUST NOT hardcode transition logic — they call `assertTransition`. Keeping the
 * workflow as data (a map) means changing it is a one-line edit, and future
 * modules (service requests, PM, etc.) reuse the same rules.
 *
 *   OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
 *   (+ ON_HOLD detours, CANCELLED exits, and REOPEN back to IN_PROGRESS)
 */
@Injectable()
export class TicketStatusService {
  private readonly transitions: Readonly<Record<TicketStatus, TicketStatus[]>> = {
    [TicketStatus.OPEN]: [
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.ON_HOLD,
      TicketStatus.CANCELLED,
    ],
    [TicketStatus.ASSIGNED]: [
      TicketStatus.IN_PROGRESS,
      TicketStatus.ON_HOLD,
      TicketStatus.OPEN,
      TicketStatus.CANCELLED,
    ],
    [TicketStatus.IN_PROGRESS]: [
      TicketStatus.ON_HOLD,
      TicketStatus.RESOLVED,
      TicketStatus.CANCELLED,
    ],
    [TicketStatus.ON_HOLD]: [
      TicketStatus.IN_PROGRESS,
      TicketStatus.CANCELLED,
    ],
    [TicketStatus.RESOLVED]: [
      TicketStatus.CLOSED,
      TicketStatus.IN_PROGRESS, // reopen
    ],
    [TicketStatus.CLOSED]: [
      TicketStatus.IN_PROGRESS, // reopen (privileged)
    ],
    [TicketStatus.CANCELLED]: [], // terminal
  };

  canTransition(from: TicketStatus, to: TicketStatus): boolean {
    if (from === to) return false;
    return this.transitions[from].includes(to);
  }

  assertTransition(from: TicketStatus, to: TicketStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} → ${to}. Allowed: ${
          this.transitions[from].join(', ') || '(none — terminal)'
        }`,
      );
    }
  }

  allowedNext(from: TicketStatus): TicketStatus[] {
    return [...this.transitions[from]];
  }

  isTerminal(status: TicketStatus): boolean {
    return this.transitions[status].length === 0;
  }
}
