import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';

/**
 * Authority on Work Order status transitions (same pattern as the Ticket/Service
 * status services — never hardcode transitions in controllers).
 *
 *   PENDING_APPROVAL → APPROVED → ASSIGNED → ACCEPTED → IN_PROGRESS →
 *     COMPLETED → VERIFIED → CLOSED
 *        (+ ON_HOLD detours, CANCELLED exits, redo/reopen back to IN_PROGRESS)
 *
 * Business rule: a Work Order is APPROVED work. Recommendations start
 * PENDING_APPROVAL and reach the execution lane only via APPROVED (or REJECTED,
 * terminal). Manual/emergency work orders skip approval and start at DRAFT.
 * CLOSED is reachable ONLY from VERIFIED — completed work must be verified first.
 */
@Injectable()
export class WorkOrderStatusService {
  private readonly transitions: Readonly<
    Record<WorkOrderStatus, WorkOrderStatus[]>
  > = {
    [WorkOrderStatus.PENDING_APPROVAL]: [
      WorkOrderStatus.APPROVED,
      WorkOrderStatus.REJECTED,
      WorkOrderStatus.CANCELLED,
    ],
    [WorkOrderStatus.APPROVED]: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.CANCELLED],
    [WorkOrderStatus.REJECTED]: [], // terminal
    [WorkOrderStatus.DRAFT]: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.CANCELLED],
    [WorkOrderStatus.ASSIGNED]: [
      WorkOrderStatus.ACCEPTED,
      WorkOrderStatus.IN_PROGRESS,
      WorkOrderStatus.CANCELLED,
    ],
    [WorkOrderStatus.ACCEPTED]: [
      WorkOrderStatus.IN_PROGRESS,
      WorkOrderStatus.ON_HOLD,
      WorkOrderStatus.CANCELLED,
    ],
    [WorkOrderStatus.IN_PROGRESS]: [
      WorkOrderStatus.ON_HOLD,
      WorkOrderStatus.COMPLETED,
      WorkOrderStatus.CANCELLED,
    ],
    [WorkOrderStatus.ON_HOLD]: [
      WorkOrderStatus.IN_PROGRESS,
      WorkOrderStatus.CANCELLED,
    ],
    [WorkOrderStatus.COMPLETED]: [
      WorkOrderStatus.VERIFIED,
      WorkOrderStatus.IN_PROGRESS, // redo
      WorkOrderStatus.CANCELLED,
    ],
    [WorkOrderStatus.VERIFIED]: [
      WorkOrderStatus.CLOSED,
      WorkOrderStatus.IN_PROGRESS, // reopen
    ],
    [WorkOrderStatus.CLOSED]: [], // terminal
    [WorkOrderStatus.CANCELLED]: [], // terminal
  };

  canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
    if (from === to) return false;
    return this.transitions[from].includes(to);
  }

  assertTransition(from: WorkOrderStatus, to: WorkOrderStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition: ${from} → ${to}. Allowed: ${
          this.transitions[from].join(', ') || '(none — terminal)'
        }`,
      );
    }
  }

  allowedNext(from: WorkOrderStatus): WorkOrderStatus[] {
    return [...this.transitions[from]];
  }

  isTerminal(status: WorkOrderStatus): boolean {
    return this.transitions[status].length === 0;
  }
}
