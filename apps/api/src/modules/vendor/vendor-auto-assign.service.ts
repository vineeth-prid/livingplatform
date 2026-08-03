import { Injectable, Logger } from '@nestjs/common';
import { PersonStatus, ServiceRequestStatus, TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/** Statuses that still occupy a vendor — the definition of "current workload". */
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

export interface AutoAssignCandidate {
  vendorId: string;
  vendorName: string;
  openWorkload: number;
}

/**
 * Picks the vendor a new ticket or service request should go to.
 *
 * The rule, in order:
 *   1. category matches the vendor's `category` or one of `serviceCategories`
 *   2. the vendor covers this community (`communityIds`)
 *   3. the vendor is ACTIVE and not soft-deleted
 *   4. of those, the one with the **least open workload** (tickets + service
 *      requests still in a live status), ties broken by name for determinism
 *
 * No match → returns null and the caller leaves the work unassigned for a human.
 * **Auto-assignment must never block or fail a creation**, so every entry point
 * here is wrapped by the caller in a catch: a bad lookup loses the assignment,
 * never the ticket.
 */
@Injectable()
export class VendorAutoAssignService {
  private readonly logger = new Logger(VendorAutoAssignService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The best vendor for a category in a community, or null.
   * `category` is the free-text catalog value (ticket category key/name or
   * service key/name) — vendors carry the same admin-managed strings.
   */
  async pick(input: {
    tenantId: string;
    communityId: string;
    categories: string[];
  }): Promise<AutoAssignCandidate | null> {
    const candidates = await this.candidates(input);
    return candidates[0] ?? null;
  }

  /** Every eligible vendor, least-loaded first. Exposed for the admin UI. */
  async candidates(input: {
    tenantId: string;
    communityId: string;
    categories: string[];
  }): Promise<AutoAssignCandidate[]> {
    const wanted = input.categories.map(normalize).filter(Boolean);
    if (wanted.length === 0) return [];

    // Category matching is done in memory: the values are free-text and
    // case/spacing varies between the catalog and what an admin typed on the
    // vendor, so a SQL equality filter would silently miss real matches.
    const vendors = await this.prisma.vendor.findMany({
      where: {
        tenantId: input.tenantId,
        deletedAt: null,
        status: PersonStatus.ACTIVE,
        communityIds: { has: input.communityId },
      },
      select: { id: true, name: true, category: true, serviceCategories: true },
    });

    const matched = vendors.filter((v) => {
      const owned = [v.category, ...v.serviceCategories].map(normalize);
      return owned.some((c) => c && wanted.includes(c));
    });
    if (matched.length === 0) return [];

    const workload = await this.openWorkload(
      matched.map((v) => v.id),
      input.communityId,
    );

    return matched
      .map((v) => ({
        vendorId: v.id,
        vendorName: v.name,
        openWorkload: workload.get(v.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          a.openWorkload - b.openWorkload || a.vendorName.localeCompare(b.vendorName),
      );
  }

  /**
   * Open tickets + open service requests per vendor, in this community.
   * Two grouped counts rather than a row scan, so this stays cheap on the
   * creation hot path.
   */
  private async openWorkload(
    vendorIds: string[],
    communityId: string,
  ): Promise<Map<string, number>> {
    const [tickets, requests] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['assignedVendorId'],
        where: {
          communityId,
          deletedAt: null,
          assignedVendorId: { in: vendorIds },
          status: { in: OPEN_TICKET_STATUSES },
        },
        _count: { _all: true },
      }),
      this.prisma.serviceRequest.groupBy({
        by: ['assignedVendorId'],
        where: {
          communityId,
          deletedAt: null,
          assignedVendorId: { in: vendorIds },
          status: { in: OPEN_REQUEST_STATUSES },
        },
        _count: { _all: true },
      }),
    ]);

    const total = new Map<string, number>();
    for (const row of [...tickets, ...requests]) {
      if (!row.assignedVendorId) continue;
      total.set(row.assignedVendorId, (total.get(row.assignedVendorId) ?? 0) + row._count._all);
    }
    return total;
  }

  /** Log a decision without ever letting it surface as an error to the caller. */
  logOutcome(kind: 'ticket' | 'service-request', entityId: string, picked: AutoAssignCandidate | null): void {
    if (picked) {
      this.logger.log(
        `Auto-assigned ${kind} ${entityId} → vendor ${picked.vendorId} (workload ${picked.openWorkload})`,
      );
    } else {
      this.logger.debug(`No vendor matched for ${kind} ${entityId} — left unassigned`);
    }
  }
}

/** Case- and separator-insensitive comparison key for free-text categories. */
function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}
