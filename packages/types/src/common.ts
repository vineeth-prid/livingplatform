export type ID = string;
export type ISODate = string;

/** Success envelope returned by the API (TransformInterceptor). */
export interface ApiResponse<T> {
  success: true;
  data: T;
}

/** Error body from the global exception filter. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export type SortDir = 'asc' | 'desc';

/** Base query for list endpoints. */
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: SortDir;
}

export interface AuditFields {
  createdAt: ISODate;
  updatedAt: ISODate;
  createdById?: ID | null;
  updatedById?: ID | null;
  deletedAt?: ISODate | null;
}
