import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExpenseSource, ExpenseStatus, Prisma, WorkOrderStatus } from '@prisma/client';

import { paginate } from '../../common/dto/pagination.dto';
import { resolveSort } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CommunityAccessService } from '../tenancy/community-access.service';
import type {
  CreateExpenseDto,
  QueryExpenseDto,
  UpdateExpenseDto,
  UpsertExpenseCategoryDto,
} from './dto/expense.dto';
import { atMidday, dayRange, monthBounds, periodBounds, todayIn, ymdOf } from './expense-dates';

const SORTABLE = ['expenseDate', 'amount', 'title', 'createdAt'] as const;
/** Where work-order costs land unless an admin re-files them. */
export const WORK_ORDER_CATEGORY = 'Work orders';
/** Statuses at which a manager has confirmed the work — and so the cost. */
const RECOGNISED = new Set<WorkOrderStatus>([WorkOrderStatus.VERIFIED, WorkOrderStatus.CLOSED]);

type ExpenseFilter = Pick<QueryExpenseDto, 'period' | 'from' | 'to' | 'categoryId' | 'source' | 'search' | 'includeReversed'>;
type ExpenseRow = Prisma.ExpenseGetPayload<{ include: { category: { select: { id: true; name: true } } } }>;

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  // ── Categories ─────────────────────────────────────────────────────────────

  async listCategories(communityId: string) {
    await this.access.assert(communityId);
    const rows = await this.prisma.expenseCategory.findMany({
      where: { communityId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: { where: { deletedAt: null } } } } },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, expenseCount: _count.expenses }));
  }

  async createCategory(communityId: string, dto: UpsertExpenseCategoryDto, actor: AuthenticatedUser) {
    await this.access.assert(communityId);
    const name = dto.name.trim();
    await this.assertCategoryNameFree(communityId, name);
    const row = await this.prisma.expenseCategory.create({
      data: { communityId, name, description: dto.description?.trim() || null, createdById: actor.id, updatedById: actor.id },
    });
    await this.record(actor, communityId, 'expense_category.created', row.id, { name });
    return row;
  }

  async updateCategory(communityId: string, id: string, dto: UpsertExpenseCategoryDto, actor: AuthenticatedUser) {
    const current = await this.categoryOrThrow(communityId, id);
    const name = dto.name.trim();
    if (name.toLowerCase() !== current.name.toLowerCase()) await this.assertCategoryNameFree(communityId, name, id);
    const row = await this.prisma.expenseCategory.update({
      where: { id },
      data: { name, description: dto.description?.trim() || null, updatedById: actor.id },
    });
    await this.record(actor, communityId, 'expense_category.updated', id, { from: current.name, to: name });
    return row;
  }

  /** Only an unused category can go — anything else would orphan financial history. */
  async removeCategory(communityId: string, id: string, actor: AuthenticatedUser) {
    const current = await this.categoryOrThrow(communityId, id);
    const used = await this.prisma.expense.count({ where: { categoryId: id } });
    if (used > 0) {
      throw new ConflictException(
        `"${current.name}" is used by ${used} expense${used === 1 ? '' : 's'} — move them to another category before deleting it`,
      );
    }
    await this.prisma.expenseCategory.delete({ where: { id } });
    await this.record(actor, communityId, 'expense_category.deleted', id, { name: current.name });
    return { id, deleted: true };
  }

  // ── Expenses ───────────────────────────────────────────────────────────────

  async list(communityId: string, query: QueryExpenseDto) {
    const { timezone } = await this.community(communityId);
    const where = this.whereFor(communityId, query, timezone);
    const [rows, total, sum] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: resolveSort(query, SORTABLE, 'expenseDate'),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.aggregate({ where: { ...where, status: ExpenseStatus.ACTIVE }, _sum: { amount: true } }),
    ]);
    const page = paginate(await this.present(rows), total, query);
    return { ...page, totalAmount: Number(sum._sum.amount ?? 0) };
  }

  /**
   * The summary cards, all from the expense rows themselves. Total and count
   * follow every filter; the two month cards follow the non-date filters
   * (category, source, search) over their own month in the community's zone.
   */
  async summary(communityId: string, query: QueryExpenseDto) {
    const { timezone } = await this.community(communityId);
    const base = { ...query, includeReversed: false };
    const today = todayIn(timezone);
    const thisMonth = monthBounds(today);
    const lastMonth = monthBounds(today, -1);
    const sum = async (where: Prisma.ExpenseWhereInput) =>
      Number((await this.prisma.expense.aggregate({ where, _sum: { amount: true } }))._sum.amount ?? 0);
    const undated = { ...base, period: undefined, from: undefined, to: undefined };
    const filtered = this.whereFor(communityId, base, timezone);
    const [total, count, currentMonth, previousMonth] = await Promise.all([
      sum(filtered),
      this.prisma.expense.count({ where: filtered }),
      sum(this.whereFor(communityId, { ...undated, ...thisMonth }, timezone)),
      sum(this.whereFor(communityId, { ...undated, ...lastMonth }, timezone)),
    ]);
    return {
      total, count, currentMonth, previousMonth,
      currentMonthLabel: thisMonth.from.slice(0, 7), previousMonthLabel: lastMonth.from.slice(0, 7),
      timezone,
    };
  }

  async findOne(communityId: string, id: string) {
    await this.access.assert(communityId);
    const row = await this.expenseOrThrow(communityId, id);
    const [view] = await this.present([row]);
    return view;
  }

  async create(communityId: string, dto: CreateExpenseDto, actor: AuthenticatedUser) {
    const { timezone } = await this.community(communityId);
    await this.categoryOrThrow(communityId, dto.categoryId);
    this.assertNotFuture(dto.expenseDate, timezone);
    await this.storage.assertOwnedKey(dto.attachmentKey, this.attachmentScope(communityId));
    const row = await this.prisma.expense.create({
      data: {
        communityId,
        categoryId: dto.categoryId,
        title: dto.title.trim(),
        amount: new Prisma.Decimal(dto.amount),
        expenseDate: atMidday(dto.expenseDate),
        description: dto.description?.trim() || null,
        payee: dto.payee?.trim() || null,
        referenceNumber: dto.referenceNumber?.trim() || null,
        paymentMethod: dto.paymentMethod?.trim() || null,
        attachmentKey: dto.attachmentKey ?? null,
        attachmentName: dto.attachmentKey ? dto.attachmentName ?? null : null,
        source: ExpenseSource.MANUAL,
        createdById: actor.id,
        updatedById: actor.id,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    await this.record(actor, communityId, 'expense.created', row.id, { amount: dto.amount, title: row.title });
    return (await this.present([row]))[0];
  }

  async update(communityId: string, id: string, dto: UpdateExpenseDto, actor: AuthenticatedUser) {
    const { timezone } = await this.community(communityId);
    const current = await this.expenseOrThrow(communityId, id);
    if (current.source === ExpenseSource.WORK_ORDER && (dto.amount !== undefined || dto.expenseDate !== undefined || dto.title !== undefined)) {
      throw new BadRequestException(
        'The amount, date and title of a work-order expense follow the work order — change the actual cost there',
      );
    }
    if (dto.categoryId) await this.categoryOrThrow(communityId, dto.categoryId);
    if (dto.expenseDate) this.assertNotFuture(dto.expenseDate, timezone);
    await this.storage.assertOwnedKey(dto.attachmentKey, this.attachmentScope(communityId), current.attachmentKey);

    const row = await this.prisma.expense.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        categoryId: dto.categoryId,
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        expenseDate: dto.expenseDate ? atMidday(dto.expenseDate) : undefined,
        description: dto.description !== undefined ? dto.description.trim() || null : undefined,
        payee: dto.payee !== undefined ? dto.payee.trim() || null : undefined,
        referenceNumber: dto.referenceNumber !== undefined ? dto.referenceNumber.trim() || null : undefined,
        paymentMethod: dto.paymentMethod !== undefined ? dto.paymentMethod.trim() || null : undefined,
        attachmentKey: dto.attachmentKey !== undefined ? dto.attachmentKey || null : undefined,
        attachmentName: dto.attachmentKey !== undefined ? (dto.attachmentKey ? dto.attachmentName ?? null : null) : undefined,
        updatedById: actor.id,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    // A replaced attachment is removed from storage rather than left orphaned.
    if (dto.attachmentKey !== undefined && current.attachmentKey && current.attachmentKey !== dto.attachmentKey) {
      await this.storage.delete(current.attachmentKey).catch(() => undefined);
    }
    await this.record(actor, communityId, 'expense.updated', id, {
      changes: Object.keys(dto),
      ...(dto.amount !== undefined ? { amountFrom: Number(current.amount), amountTo: dto.amount } : {}),
    });
    return (await this.present([row]))[0];
  }

  /** Soft delete with an audit entry. Work-order expenses are reversed, not deleted. */
  async remove(communityId: string, id: string, actor: AuthenticatedUser) {
    const current = await this.expenseOrThrow(communityId, id);
    if (current.source === ExpenseSource.WORK_ORDER) {
      throw new BadRequestException(
        'A work-order expense cannot be deleted — clear the work order\'s actual cost to reverse it',
      );
    }
    await this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actor.id } });
    await this.record(actor, communityId, 'expense.deleted', id, { amount: Number(current.amount), title: current.title });
    return { id, deleted: true };
  }

  async attachmentUploadUrl(communityId: string, fileName: string, contentType?: string) {
    await this.access.assert(communityId);
    const key = this.storage.buildKey(this.attachmentScope(communityId), fileName);
    const signed = await this.storage.signUpload(key, contentType ? { contentType } : undefined);
    return { key, uploadUrl: signed.url, expiresAt: signed.expiresAt };
  }

  // ── Work-order integration ─────────────────────────────────────────────────

  /**
   * Bring a work order's expense in line with the work order. Called after any
   * change that could affect it (verification, actual-cost edits, removal).
   *
   * It reconciles state rather than reacting to an event, so it is idempotent:
   * calling it twice, or after a retry, changes nothing the second time, and
   * the unique workOrderId means a race can never produce two rows.
   *
   *  • Verified/closed with an actual cost > 0 → one ACTIVE expense of that amount.
   *  • Otherwise (no cost, cost cleared, work order removed) → an existing
   *    expense is REVERSED, kept for the record and left out of totals.
   *  • Estimates never count; nothing is recorded before verification.
   */
  async syncWorkOrder(workOrderId: string, actorId: string | null): Promise<void> {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, number: true, communityId: true, title: true, status: true, actualTotalCost: true, verifiedDate: true, deletedAt: true },
    });
    const existing = await this.prisma.expense.findUnique({ where: { workOrderId } });
    const amount = wo?.actualTotalCost ? new Prisma.Decimal(wo.actualTotalCost) : null;
    const recognised = !!wo && !wo.deletedAt && RECOGNISED.has(wo.status) && !!amount && amount.gt(0);

    if (recognised) {
      const title = `WO-${String(wo.number).padStart(6, '0')} · ${wo.title}`.slice(0, 200);
      const expenseDate = atMidday(ymdOf(wo.verifiedDate ?? new Date()));
      if (!existing) {
        const categoryId = await this.workOrderCategoryId(wo.communityId);
        try {
          const row = await this.prisma.expense.create({
            data: {
              communityId: wo.communityId, categoryId, title, amount: amount!, expenseDate,
              source: ExpenseSource.WORK_ORDER, workOrderId, createdById: actorId, updatedById: actorId,
            },
          });
          await this.record({ id: actorId }, wo.communityId, 'expense.recorded_from_work_order', row.id, { workOrderId, amount: Number(amount) });
        } catch (err) {
          // Lost a race to a concurrent call: the row now exists — reconcile it instead.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return this.syncWorkOrder(workOrderId, actorId);
          throw err;
        }
        return;
      }
      const changed = !new Prisma.Decimal(existing.amount).eq(amount!) || existing.status !== ExpenseStatus.ACTIVE || existing.title !== title;
      if (!changed) return;
      await this.prisma.expense.update({
        where: { id: existing.id },
        data: { amount: amount!, title, status: ExpenseStatus.ACTIVE, reversedAt: null, reversalReason: null, updatedById: actorId },
      });
      await this.record({ id: actorId }, wo.communityId, 'expense.updated_from_work_order', existing.id, {
        workOrderId, amountFrom: Number(existing.amount), amountTo: Number(amount), reinstated: existing.status !== ExpenseStatus.ACTIVE,
      });
      return;
    }

    if (existing && existing.status === ExpenseStatus.ACTIVE) {
      const reason = !wo || wo.deletedAt ? 'Work order removed' : 'Work order actual cost withdrawn';
      await this.prisma.expense.update({
        where: { id: existing.id },
        data: { status: ExpenseStatus.REVERSED, reversedAt: new Date(), reversalReason: reason, updatedById: actorId },
      });
      await this.record({ id: actorId }, existing.communityId, 'expense.reversed', existing.id, { workOrderId, reason, amount: Number(existing.amount) });
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private whereFor(communityId: string, q: ExpenseFilter, timezone: string): Prisma.ExpenseWhereInput {
    const bounds = q.period ? periodBounds(q.period, timezone) : { from: q.from, to: q.to };
    const search = q.search?.trim();
    return {
      communityId,
      deletedAt: null,
      ...(q.includeReversed ? {} : { status: ExpenseStatus.ACTIVE }),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(dayRange(bounds.from, bounds.to) ? { expenseDate: dayRange(bounds.from, bounds.to) } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { payee: { contains: search, mode: 'insensitive' } },
              { referenceNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async present(rows: ExpenseRow[] | Prisma.ExpenseGetPayload<object>[]) {
    const userIds = [...new Set(rows.flatMap((r) => [r.createdById, r.updatedById]).filter((x): x is string => !!x))];
    const woIds = rows.map((r) => r.workOrderId).filter((x): x is string => !!x);
    const [users, workOrders] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
        : [],
      woIds.length
        ? this.prisma.workOrder.findMany({ where: { id: { in: woIds } }, select: { id: true, number: true, status: true } })
        : [],
    ]);
    const name = (id: string | null) => {
      const u = users.find((x) => x.id === id);
      return u ? `${u.firstName} ${u.lastName}`.trim() : null;
    };
    return Promise.all(
      rows.map(async (r) => {
        const wo = workOrders.find((w) => w.id === r.workOrderId);
        return {
          ...r,
          amount: Number(r.amount),
          expenseDate: ymdOf(r.expenseDate),
          attachmentUrl: await this.storage.signedUrl(r.attachmentKey),
          createdByName: r.createdById ? name(r.createdById) : 'System',
          updatedByName: name(r.updatedById),
          workOrder: wo ? { id: wo.id, number: `WO-${String(wo.number).padStart(6, '0')}`, status: wo.status } : null,
        };
      }),
    );
  }

  private async community(communityId: string) {
    await this.access.assert(communityId);
    return this.prisma.community.findUniqueOrThrow({ where: { id: communityId }, select: { timezone: true } });
  }

  private assertNotFuture(ymd: string, timezone: string) {
    if (Number.isNaN(atMidday(ymd).getTime()) || ymdOf(atMidday(ymd)) !== ymd) {
      throw new BadRequestException(`${ymd} is not a real date`);
    }
    if (ymd > todayIn(timezone)) throw new BadRequestException('An expense date cannot be in the future');
  }

  private async assertCategoryNameFree(communityId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.expenseCategory.findFirst({
      where: { communityId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`A category called "${name}" already exists`);
  }

  private async categoryOrThrow(communityId: string, id: string) {
    await this.access.assert(communityId);
    const row = await this.prisma.expenseCategory.findFirst({ where: { id, communityId } });
    if (!row) throw new NotFoundException('Expense category not found in this community');
    return row;
  }

  private async expenseOrThrow(communityId: string, id: string) {
    await this.access.assert(communityId);
    const row = await this.prisma.expense.findFirst({
      where: { id, communityId, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException('Expense not found');
    return row;
  }

  /** The default category for work-order costs — created the first time it is needed. */
  private async workOrderCategoryId(communityId: string): Promise<string> {
    const row = await this.prisma.expenseCategory.upsert({
      where: { communityId_name: { communityId, name: WORK_ORDER_CATEGORY } },
      create: { communityId, name: WORK_ORDER_CATEGORY, description: 'Actual costs of verified work orders', isSystem: true },
      update: {},
      select: { id: true },
    });
    return row.id;
  }

  private attachmentScope(communityId: string) {
    return `communities/${communityId}/expenses`;
  }

  private async record(
    actor: Pick<AuthenticatedUser, 'id'> & Partial<Pick<AuthenticatedUser, 'email' | 'tenantId'>> | { id: string | null },
    communityId: string,
    action: string,
    resourceId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    await this.audit.record({
      action,
      resource: 'expenses',
      resourceId,
      actorId: actor.id ?? undefined,
      actorEmail: 'email' in actor ? actor.email : undefined,
      tenantId: 'tenantId' in actor ? actor.tenantId ?? undefined : undefined,
      communityId,
      metadata,
    });
  }
}
