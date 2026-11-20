import type { ListParams, Paginated } from '@living/types';

import type { HttpClient } from '../http';

export type ExpenseSource = 'MANUAL' | 'WORK_ORDER';
export type ExpenseStatus = 'ACTIVE' | 'REVERSED';
export type ExpensePeriod = 'current-month' | 'previous-month' | 'current-year';

export interface ExpenseCategory {
  id: string;
  communityId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  expenseCount: number;
}

export interface Expense {
  id: string;
  communityId: string;
  categoryId: string;
  category: { id: string; name: string };
  title: string;
  amount: number;
  /** YYYY-MM-DD */
  expenseDate: string;
  description: string | null;
  payee: string | null;
  referenceNumber: string | null;
  paymentMethod: string | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  attachmentUrl: string | null;
  source: ExpenseSource;
  workOrderId: string | null;
  workOrder: { id: string; number: string; status: string } | null;
  status: ExpenseStatus;
  reversedAt: string | null;
  reversalReason: string | null;
  createdById: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseFilters {
  period?: ExpensePeriod;
  from?: string;
  to?: string;
  categoryId?: string;
  source?: ExpenseSource;
  search?: string;
  includeReversed?: boolean;
}

export interface ExpenseSummary {
  total: number;
  count: number;
  currentMonth: number;
  previousMonth: number;
  currentMonthLabel: string;
  previousMonthLabel: string;
  timezone: string;
}

export interface ExpenseInput {
  title?: string;
  categoryId?: string;
  amount?: number;
  expenseDate?: string;
  description?: string;
  payee?: string;
  referenceNumber?: string;
  paymentMethod?: string;
  attachmentKey?: string;
  attachmentName?: string;
}

/** The community expense ledger: categories, expenses, summary cards. */
export class ExpensesResource {
  constructor(private readonly http: HttpClient) {}

  categories(communityId: string): Promise<ExpenseCategory[]> {
    return this.http.get(`/communities/${communityId}/expense-categories`);
  }
  createCategory(communityId: string, input: { name: string; description?: string }): Promise<ExpenseCategory> {
    return this.http.post(`/communities/${communityId}/expense-categories`, input);
  }
  updateCategory(communityId: string, id: string, input: { name: string; description?: string }): Promise<ExpenseCategory> {
    return this.http.patch(`/communities/${communityId}/expense-categories/${id}`, input);
  }
  deleteCategory(communityId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/communities/${communityId}/expense-categories/${id}`);
  }

  list(communityId: string, params: ExpenseFilters & ListParams): Promise<Paginated<Expense> & { totalAmount: number }> {
    return this.http.get(`/communities/${communityId}/expenses`, params as Record<string, unknown>);
  }
  summary(communityId: string, params: ExpenseFilters): Promise<ExpenseSummary> {
    return this.http.get(`/communities/${communityId}/expenses/summary`, params as Record<string, unknown>);
  }
  get(communityId: string, id: string): Promise<Expense> {
    return this.http.get(`/communities/${communityId}/expenses/${id}`);
  }
  create(communityId: string, input: ExpenseInput): Promise<Expense> {
    return this.http.post(`/communities/${communityId}/expenses`, input as Record<string, unknown>);
  }
  update(communityId: string, id: string, input: ExpenseInput): Promise<Expense> {
    return this.http.patch(`/communities/${communityId}/expenses/${id}`, input as Record<string, unknown>);
  }
  remove(communityId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/communities/${communityId}/expenses/${id}`);
  }
  attachmentUploadUrl(communityId: string, fileName: string, contentType?: string): Promise<{ key: string; uploadUrl: string }> {
    return this.http.post(`/communities/${communityId}/expenses/upload-url`, { fileName, contentType });
  }
}
