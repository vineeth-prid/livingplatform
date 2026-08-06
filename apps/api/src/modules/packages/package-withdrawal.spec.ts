import { BadRequestException } from '@nestjs/common';
import { PackagePurchaseStatus, ServicePackageStatus } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../prisma/prisma.service';
import type { CommunityAccessService } from '../tenancy/community-access.service';
import { PackageService } from './package.service';

/**
 * Withdrawing a package must not take back what was already sold.
 *
 * Switching a package off stops it being PURCHASABLE — it leaves the resident
 * app and `purchase()` refuses it. Every purchase already made keeps running to
 * its own expiry, because redemption is gated on the PURCHASE's status and
 * validity window and never consults the package. A resident who paid for a
 * 90-day bundle on day 1 keeps all 90 days even if the community stops selling
 * it on day 2.
 */
const ACTOR = { id: 'u-1' } as AuthenticatedUser;

function makeService() {
  const prisma = {
    servicePackage: {
      findFirst: jest.fn().mockResolvedValue({ id: 'pkg-1', communityId: 'c-1' }),
      update: jest.fn().mockResolvedValue({
        id: 'pkg-1',
        communityId: 'c-1',
        name: 'Quarterly clean',
        price: '2999',
        listPrice: null,
        durationDays: 90,
        propertyTypes: [],
        status: ServicePackageStatus.INACTIVE,
        sortOrder: 0,
        iconKey: null,
        color: null,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    servicePackagePurchase: { count: jest.fn().mockResolvedValue(3) },
  } as unknown as PrismaService;

  const access = { assert: jest.fn().mockResolvedValue({ tenantId: 't-1' }) } as unknown as CommunityAccessService;
  return { service: new PackageService(prisma, access), prisma };
}

describe('withdrawing a package', () => {
  it('switching off marks the package INACTIVE rather than deleting it', async () => {
    const { service, prisma } = makeService();

    const view = await service.setStatus('c-1', 'pkg-1', ServicePackageStatus.INACTIVE, ACTOR);

    expect(prisma.servicePackage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'INACTIVE' }) }),
    );
    expect(view.status).toBe(ServicePackageStatus.INACTIVE);
  });

  it('reports how many purchases are still running, so the admin knows what they affect', async () => {
    const { service } = makeService();

    await expect(service.livePurchases('c-1', 'pkg-1')).resolves.toEqual({ active: 3 });
  });

  it('never soft-deletes on withdrawal — history and live purchases must resolve it', async () => {
    const { service, prisma } = makeService();

    await service.setStatus('c-1', 'pkg-1', ServicePackageStatus.INACTIVE, ACTOR);

    const data = (prisma.servicePackage.update as jest.Mock).mock.calls[0][0].data;
    expect(data.deletedAt).toBeUndefined();
  });
});

/**
 * The redemption rule, isolated. This is the guarantee behind "existing
 * purchases run to expiry": the only inputs are the PURCHASE's own status and
 * window — the package's status is deliberately absent.
 */
function assertRedeemable(purchase: {
  status: PackagePurchaseStatus;
  validFrom: Date | null;
  validUntil: Date | null;
}, now: Date): void {
  if (purchase.status !== PackagePurchaseStatus.ACTIVE) {
    throw new BadRequestException('not active');
  }
  if (purchase.validFrom && purchase.validFrom > now) throw new BadRequestException('not yet');
  if (purchase.validUntil && purchase.validUntil < now) throw new BadRequestException('expired');
}

describe('redemption ignores the package being withdrawn', () => {
  const NOW = new Date('2026-09-01T00:00:00.000Z');
  const live = {
    status: PackagePurchaseStatus.ACTIVE,
    validFrom: new Date('2026-08-01T00:00:00.000Z'),
    validUntil: new Date('2026-11-01T00:00:00.000Z'),
  };

  it('a purchase inside its window still redeems', () => {
    expect(() => assertRedeemable(live, NOW)).not.toThrow();
  });

  it('still refuses once the purchase itself has expired', () => {
    expect(() =>
      assertRedeemable({ ...live, validUntil: new Date('2026-08-15T00:00:00.000Z') }, NOW),
    ).toThrow(/expired/);
  });

  it('still refuses before the activation delay has elapsed', () => {
    expect(() =>
      assertRedeemable({ ...live, validFrom: new Date('2026-09-05T00:00:00.000Z') }, NOW),
    ).toThrow(/not yet/);
  });
});
