import { Injectable } from '@nestjs/common';
import { OwnershipStatus } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';

/**
 * THE authority on "who is financially responsible for this unit".
 *
 * Maintenance is a debt between the OWNER and the association. Before this,
 * every financial surface keyed off `MaintenanceInvoice.residentId`, which was
 * filled with whichever occupancy row sorted first — so a tenant recorded as the
 * unit's primary resident saw, and was chased for, their landlord's bills.
 *
 * Billing, payments and the Notification Engine all resolve through here so the
 * three can never disagree about who owes what.
 *
 * ── Owners only ──────────────────────────────────────────────────────────────
 * Every unit is created with an owner. Maintenance is billed to, notified to
 * and payable by the unit's active owners and nobody else — occupancy never
 * grants financial access, whatever the occupant's role. A legacy unit still
 * missing an owner is billed to nobody until the admin records one (the
 * ownership-gaps worklist).
 */
@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active owners of a unit, primary first. Empty when ownership is unknown. */
  async ownersOfUnit(unitId: string) {
    return this.prisma.unitOwnership.findMany({
      where: { unitId, deletedAt: null, status: OwnershipStatus.ACTIVE },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        residentId: true,
        isPrimary: true,
        sharePercent: true,
        startDate: true,
        resident: {
          select: {
            id: true, firstName: true, lastName: true, mobile: true, email: true,
            status: true, userId: true,
            user: { select: { id: true, status: true, email: true } },
          },
        },
      },
    });
  }

  /** Resident ids of a unit's active owners, primary first. */
  async ownerResidentIds(unitId: string): Promise<string[]> {
    const rows = await this.prisma.unitOwnership.findMany({
      where: { unitId, deletedAt: null, status: OwnershipStatus.ACTIVE },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { residentId: true },
    });
    return rows.map((r) => r.residentId);
  }

  /** The resident a unit's invoice is filed under — its primary owner, or null. */
  async billableResidentFor(unitId: string): Promise<string | null> {
    return (await this.ownerResidentIds(unitId))[0] ?? null;
  }

  /** Who receives a unit's maintenance notifications: every active owner. */
  async notifiableResidentsFor(unitId: string): Promise<string[]> {
    return this.ownerResidentIds(unitId);
  }

  /** The caller's own resident ids within a community. */
  async myResidentIds(actor: AuthenticatedUser, communityId?: string): Promise<string[]> {
    const rows = await this.prisma.resident.findMany({
      where: {
        userId: actor.id,
        deletedAt: null,
        ...(communityId ? { communityId } : {}),
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Units the caller owns outright. The basis of every owner-only surface. */
  async myOwnedUnitIds(actor: AuthenticatedUser, communityId?: string): Promise<string[]> {
    const residentIds = await this.myResidentIds(actor, communityId);
    if (residentIds.length === 0) return [];
    const rows = await this.prisma.unitOwnership.findMany({
      where: {
        residentId: { in: residentIds },
        deletedAt: null,
        status: OwnershipStatus.ACTIVE,
        ...(communityId ? { communityId } : {}),
      },
      select: { unitId: true },
    });
    return [...new Set(rows.map((r) => r.unitId))];
  }

  /**
   * Every unit whose FINANCIALS this caller may see — the one query the billing
   * and payment scopes are built from. Owned units only: living in a flat, in
   * any role, never grants access to its dues.
   */
  async financiallyVisibleUnitIds(
    actor: AuthenticatedUser,
    communityId?: string,
  ): Promise<string[]> {
    return this.myOwnedUnitIds(actor, communityId);
  }

  /** Guard for a single unit's financial data. */
  async canAccessUnitFinancials(
    actor: AuthenticatedUser,
    unitId: string,
    communityId?: string,
  ): Promise<boolean> {
    const visible = await this.financiallyVisibleUnitIds(actor, communityId);
    return visible.includes(unitId);
  }
}
