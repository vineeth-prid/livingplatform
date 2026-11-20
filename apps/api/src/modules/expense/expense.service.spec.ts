import { ConflictException } from '@nestjs/common';
import { ExpenseSource, ExpenseStatus, Prisma } from '@prisma/client';

import { ExpenseService } from './expense.service';

/**
 * The work-order bridge must be idempotent and conservative: estimates never
 * count, a verified actual cost counts once, changes follow it, and withdrawal
 * reverses (never deletes) the record.
 */
describe('ExpenseService', () => {
  const actor = { id: 'admin-1', email: 'a@x', tenantId: 't1' } as never;
  const verifiedWo = {
    id: 'wo-1', number: 7, communityId: 'c1', title: 'Pump repair', status: 'VERIFIED',
    actualTotalCost: new Prisma.Decimal(2500), verifiedDate: new Date('2026-11-10T09:00:00Z'), deletedAt: null,
  };

  function build(state: { wo?: Record<string, unknown> | null; expense?: Record<string, unknown> | null } = {}) {
    let expense: Record<string, unknown> | null = state.expense ?? null;
    const prisma = {
      workOrder: { findUnique: jest.fn().mockResolvedValue(state.wo === undefined ? verifiedWo : state.wo) },
      expense: {
        findUnique: jest.fn(() => Promise.resolve(expense)),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          expense = { id: 'exp-1', status: 'ACTIVE', ...data };
          return Promise.resolve(expense);
        }),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          expense = { ...expense, ...data };
          return Promise.resolve(expense);
        }),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
      expenseCategory: {
        upsert: jest.fn().mockResolvedValue({ id: 'cat-wo' }),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      community: { findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }) },
    };
    const svc = new ExpenseService(
      prisma as never,
      { assert: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) } as never,
      { assertOwnedKey: jest.fn(), signedUrl: jest.fn(), delete: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
    return { svc, prisma, current: () => expense };
  }

  describe('syncWorkOrder', () => {
    it('records a verified actual cost once, in the work-order category, dated the verification day', async () => {
      const { svc, prisma, current } = build();
      await svc.syncWorkOrder('wo-1', 'admin-1');
      expect(prisma.expense.create).toHaveBeenCalledTimes(1);
      expect(current()).toMatchObject({
        categoryId: 'cat-wo', source: ExpenseSource.WORK_ORDER, workOrderId: 'wo-1', title: 'WO-000007 · Pump repair',
      });
      expect(Number(current()!.amount)).toBe(2500);
      expect((current()!.expenseDate as Date).toISOString()).toBe('2026-11-10T12:00:00.000Z');

      // A retry or duplicate event changes nothing.
      await svc.syncWorkOrder('wo-1', 'admin-1');
      expect(prisma.expense.create).toHaveBeenCalledTimes(1);
      expect(prisma.expense.update).not.toHaveBeenCalled();
    });

    it('never records an estimate, or anything before verification', async () => {
      for (const wo of [
        { ...verifiedWo, status: 'COMPLETED', actualTotalCost: new Prisma.Decimal(900) },
        { ...verifiedWo, actualTotalCost: null },
        { ...verifiedWo, status: 'CANCELLED', actualTotalCost: null },
      ]) {
        const { svc, prisma } = build({ wo });
        await svc.syncWorkOrder('wo-1', 'admin-1');
        expect(prisma.expense.create).not.toHaveBeenCalled();
      }
    });

    it('follows a corrected actual cost', async () => {
      const { svc, current } = build({
        expense: { id: 'exp-1', communityId: 'c1', amount: new Prisma.Decimal(2000), status: 'ACTIVE', title: 'WO-000007 · Pump repair' },
      });
      await svc.syncWorkOrder('wo-1', 'admin-1');
      expect(Number(current()!.amount)).toBe(2500);
    });

    it('reverses (never deletes) when the cost is withdrawn or the work order removed, and reinstates if it returns', async () => {
      const withdrawn = build({
        wo: { ...verifiedWo, status: 'CLOSED', actualTotalCost: null },
        expense: { id: 'exp-1', communityId: 'c1', amount: new Prisma.Decimal(2500), status: 'ACTIVE' },
      });
      await withdrawn.svc.syncWorkOrder('wo-1', 'admin-1');
      expect(withdrawn.current()).toMatchObject({ status: ExpenseStatus.REVERSED, reversalReason: 'Work order actual cost withdrawn' });

      const removed = build({ wo: null, expense: { id: 'exp-1', communityId: 'c1', amount: new Prisma.Decimal(2500), status: 'ACTIVE' } });
      await removed.svc.syncWorkOrder('wo-1', 'admin-1');
      expect(removed.current()).toMatchObject({ status: ExpenseStatus.REVERSED, reversalReason: 'Work order removed' });

      const back = build({
        expense: { id: 'exp-1', communityId: 'c1', amount: new Prisma.Decimal(2500), status: 'REVERSED', title: 'WO-000007 · Pump repair' },
      });
      await back.svc.syncWorkOrder('wo-1', 'admin-1');
      expect(back.current()).toMatchObject({ status: ExpenseStatus.ACTIVE, reversedAt: null });
    });

    it('recovers from losing a creation race instead of duplicating', async () => {
      const { svc, prisma } = build();
      prisma.expense.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }),
      );
      prisma.expense.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'exp-1', communityId: 'c1', amount: new Prisma.Decimal(2500), status: 'ACTIVE', title: 'WO-000007 · Pump repair' });
      await expect(svc.syncWorkOrder('wo-1', 'admin-1')).resolves.toBeUndefined();
      expect(prisma.expense.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('categories and manual expenses', () => {
    it('refuses a duplicate category name (case-insensitive)', async () => {
      const { svc, prisma } = build();
      prisma.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      await expect(svc.createCategory('c1', { name: 'electricity' }, actor)).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to delete a category that expenses use', async () => {
      const { svc, prisma } = build();
      prisma.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1', name: 'Electricity' });
      prisma.expense.count.mockResolvedValue(3);
      await expect(svc.removeCategory('c1', 'cat-1', actor)).rejects.toThrow(/used by 3 expenses/);
      expect(prisma.expenseCategory.delete).not.toHaveBeenCalled();
    });

    it('refuses a future expense date and an impossible one', async () => {
      const { svc, prisma } = build();
      prisma.expenseCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      const base = { title: 'Diesel', categoryId: 'cat-1', amount: 100 };
      await expect(svc.create('c1', { ...base, expenseDate: '2999-01-01' }, actor)).rejects.toThrow(/future/);
      await expect(svc.create('c1', { ...base, expenseDate: '2026-02-30' }, actor)).rejects.toThrow(/not a real date/);
    });

    it('locks a work-order expense amount and blocks deleting it', async () => {
      const { svc, prisma } = build();
      prisma.expense.findFirst.mockResolvedValue({ id: 'exp-1', communityId: 'c1', source: 'WORK_ORDER', amount: new Prisma.Decimal(2500) });
      await expect(svc.update('c1', 'exp-1', { amount: 1 }, actor)).rejects.toThrow(/follow the work order/);
      await expect(svc.remove('c1', 'exp-1', actor)).rejects.toThrow(/cannot be deleted/);
    });
  });
});
