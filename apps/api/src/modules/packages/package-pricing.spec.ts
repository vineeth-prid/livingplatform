import { BadRequestException } from '@nestjs/common';
import { Prisma, ServicePackageStatus } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import type { CommunityAccessService } from '../tenancy/community-access.service';
import { PackageService } from './package.service';

const dec = (n: number) => new Prisma.Decimal(n);

/**
 * A Prisma stand-in covering what package creation touches: the community's
 * tenant, the referenced services, and the created row it reads back.
 */
function makeService(services: Array<{ id: string; basePrice: number | null }>) {
  const created: Record<string, unknown>[] = [];
  const prisma = {
    community: { findUniqueOrThrow: jest.fn().mockResolvedValue({ tenantId: 't1' }) },
    service: {
      findMany: jest
        .fn()
        .mockResolvedValue(services.map((s) => ({ id: s.id, basePrice: s.basePrice === null ? null : dec(s.basePrice) }))),
    },
    servicePackage: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return Promise.resolve({
          id: 'pkg1',
          communityId: 'c1',
          name: data.name,
          description: null,
          price: dec(data.price as number),
          listPrice: data.listPrice === null ? null : dec(data.listPrice as number),
          durationDays: data.durationDays ?? 90,
          propertyTypes: data.propertyTypes ?? [],
          status: ServicePackageStatus.ACTIVE,
          sortOrder: 0,
          iconKey: null,
          color: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          items: (
            (data.items as { create: Array<{ serviceId: string; quantity: number; unitPrice: number | null }> })
              .create ?? []
          ).map((i) => ({
            serviceId: i.serviceId,
            quantity: i.quantity,
            unitPrice: i.unitPrice === null ? null : dec(i.unitPrice),
            service: { id: i.serviceId, key: i.serviceId, name: i.serviceId, isActive: true },
          })),
        });
      }),
    },
  } as unknown as PrismaService;

  const access = { assert: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) } as unknown as CommunityAccessService;
  return { service: new PackageService(prisma, access), created };
}

const actor = { id: 'u1' } as never;

describe('PackageService.create — pricing', () => {
  it('freezes the list price as the sum of quantity × service base price', async () => {
    const { service } = makeService([
      { id: 'clean', basePrice: 1500 },
      { id: 'chimney', basePrice: 2000 },
    ]);
    const view = await service.create(
      'c1',
      {
        name: '3 Month Home Care',
        price: 6000,
        items: [
          { serviceId: 'clean', quantity: 3 },
          { serviceId: 'chimney', quantity: 1 },
        ],
      },
      actor,
    );
    // 3 × 1500 + 1 × 2000 = 6500
    expect(view.listPrice).toBe(6500);
    expect(view.price).toBe(6000);
    expect(view.savings).toBe(500);
    expect(view.savingsPercent).toBe(8);
  });

  it('lets an explicit unitPrice override the catalog price', async () => {
    const { service } = makeService([{ id: 'clean', basePrice: 1500 }]);
    const view = await service.create(
      'c1',
      { name: 'Custom', price: 1000, items: [{ serviceId: 'clean', quantity: 2, unitPrice: 900 }] },
      actor,
    );
    expect(view.listPrice).toBe(1800);
  });

  /**
   * If any member service has no list price we cannot honestly claim a saving,
   * so the whole list price is null rather than a partial (misleading) sum.
   */
  it('reports no list price when a service is unpriced', async () => {
    const { service } = makeService([
      { id: 'clean', basePrice: 1500 },
      { id: 'mystery', basePrice: null },
    ]);
    const view = await service.create(
      'c1',
      {
        name: 'Mixed',
        price: 1000,
        items: [
          { serviceId: 'clean', quantity: 1 },
          { serviceId: 'mystery', quantity: 1 },
        ],
      },
      actor,
    );
    expect(view.listPrice).toBeNull();
    expect(view.savings).toBeNull();
    expect(view.savingsPercent).toBeNull();
  });

  it('never advertises a negative saving when the package costs more', async () => {
    const { service } = makeService([{ id: 'clean', basePrice: 1000 }]);
    const view = await service.create(
      'c1',
      { name: 'Premium', price: 1500, items: [{ serviceId: 'clean', quantity: 1 }] },
      actor,
    );
    expect(view.savings).toBe(0);
  });

  it('rejects the same service listed twice (quantity is the lever)', async () => {
    const { service } = makeService([{ id: 'clean', basePrice: 1000 }]);
    await expect(
      service.create(
        'c1',
        {
          name: 'Dupe',
          price: 100,
          items: [
            { serviceId: 'clean', quantity: 1 },
            { serviceId: 'clean', quantity: 2 },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a service the community cannot use', async () => {
    // The catalog lookup returns fewer rows than were requested.
    const { service } = makeService([{ id: 'clean', basePrice: 1000 }]);
    await expect(
      service.create(
        'c1',
        {
          name: 'Bad',
          price: 100,
          items: [
            { serviceId: 'clean', quantity: 1 },
            { serviceId: 'other-tenants-service', quantity: 1 },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
