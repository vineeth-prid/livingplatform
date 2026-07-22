import type { SortDir } from '@living/types';

/**
 * Shared list-view URL state (deep-linkable). `page`/`q`/`sort`/`dir` plus any
 * number of string filter params. Every master-data list route uses
 * `parseListSearch` as its `validateSearch`, so reloads and shared links restore
 * the exact table state.
 */
export interface ListSearch {
  page?: number;
  q?: string;
  sort?: string;
  dir?: SortDir;
  [filter: string]: string | number | undefined;
}

export function parseListSearch(raw: Record<string, unknown>): ListSearch {
  const out: ListSearch = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'page') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 1) out.page = Math.floor(n);
    } else if (key === 'dir') {
      if (value === 'asc' || value === 'desc') out.dir = value;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}
