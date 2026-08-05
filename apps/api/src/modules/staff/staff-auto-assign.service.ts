import { Injectable, Logger } from '@nestjs/common';
import { PersonStatus, ServiceRequestStatus, TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/** Statuses that still occupy a staff member — the definition of "workload". */
const OPEN_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.ON_HOLD,
];

const OPEN_REQUEST_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.REQUESTED,
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.SCHEDULED,
  ServiceRequestStatus.IN_PROGRESS,
];

export interface StaffAssignCandidate {
  staffId: string;
  staffName: string;
  openWorkload: number;
}

/**
 * Picks the STAFF member a new request should go to, from the categories the
 * admin allocated them.
 *
 * The in-house counterpart to VendorAutoAssignService, and deliberately the same
 * shape so the two behave predictably together: match on category, scope to the
 * community, require ACTIVE, then take the least-loaded — ties broken by name so
 * the choice is deterministic and testable.
 *
 * A staff member with NO categories is never auto-assigned. That is the
 * "no category → admin assigns manually" case from the spec, and it is why the
 * column defaults to empty: existing staff keep behaving exactly as before.
 *
 * **Auto-assignment must never block or fail a creation.** Callers wrap this in
 * a catch: a bad lookup loses the assignment, never the request.
 */
@Injectable()
export class StaffAutoAssignService {
  private readonly logger = new Logger(StaffAutoAssignService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The best staff member for a category in a community, or null. */
  async pick(input: {
    communityId: string;
    categories: string[];
  }): Promise<StaffAssignCandidate | null> {
    const candidates = await this.candidates(input);
    return candidates[0] ?? null;
  }

  /** Every eligible staff member, least-loaded first. Exposed for the admin UI. */
  async candidates(input: {
    communityId: string;
    categories: string[];
  }): Promise<StaffAssignCandidate[]> {
    const wanted = input.categories.map(normalize).filter(Boolean);
    if (wanted.length === 0) return [];

    // Matched in memory, not SQL: category values are admin-managed free text,
    // so case and separators drift between the catalogue and what was stored on
    // the staff record. An `=` filter would silently miss real matches.
    const staff = await this.prisma.staff.findMany({
      where: {
        communityId: input.communityId,
        deletedAt: null,
        status: PersonStatus.ACTIVE,
        // Cheap pre-filter; the authoritative comparison is below.
        NOT: { categories: { isEmpty: true } },
      },
      select: { id: true, firstName: true, lastName: true, categories: true },
    });

    const matched = staff.filter((s) =>
      s.categories.map(normalize).some((c) => c && wanted.includes(c)),
    );
    if (matched.length === 0) return [];

    const workload = await this.openWorkload(
      matched.map((s) => s.id),
      input.communityId,
    );

    return matched
      .map((s) => ({
        staffId: s.id,
        staffName: `${s.firstName} ${s.lastName}`.trim(),
        openWorkload: workload.get(s.id) ?? 0,
      }))
      .sort(
        (a, b) => a.openWorkload - b.openWorkload || a.staffName.localeCompare(b.staffName),
      );
  }

  /**
   * Open tickets + open service requests per staff member, in this community.
   * Two grouped counts rather than a row scan, so this stays cheap on the
   * creation hot path.
   */
  private async openWorkload(
    staffIds: string[],
    communityId: string,
  ): Promise<Map<string, number>> {
    const [tickets, requests] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['assignedStaffId'],
        where: {
          communityId,
          deletedAt: null,
          assignedStaffId: { in: staffIds },
          status: { in: OPEN_TICKET_STATUSES },
        },
        _count: { _all: true },
      }),
      this.prisma.serviceRequest.groupBy({
        by: ['assignedStaffId'],
        where: {
          communityId,
          deletedAt: null,
          assignedStaffId: { in: staffIds },
          status: { in: OPEN_REQUEST_STATUSES },
        },
        _count: { _all: true },
      }),
    ]);

    const total = new Map<string, number>();
    for (const row of [...tickets, ...requests]) {
      if (!row.assignedStaffId) continue;
      total.set(row.assignedStaffId, (total.get(row.assignedStaffId) ?? 0) + row._count._all);
    }
    return total;
  }

  /** Log a decision without ever letting it surface as an error to the caller. */
  logOutcome(
    kind: 'ticket' | 'service-request',
    entityId: string,
    picked: StaffAssignCandidate | null,
  ): void {
    if (picked) {
      this.logger.log(
        `Auto-assigned ${kind} ${entityId} → staff ${picked.staffId} (workload ${picked.openWorkload})`,
      );
    } else {
      this.logger.debug(`No staff matched for ${kind} ${entityId} — trying vendors`);
    }
  }
}

/** Case- and separator-insensitive comparison key for free-text categories. */
function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}
