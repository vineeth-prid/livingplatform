import { useCallback, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Paginated, SortDir } from '@living/types';

import type { ListSearch } from './list-search';

interface UseListQueryOptions<T> {
  /** Stable cache key prefix, e.g. ['residents', communityId]. */
  queryKey: readonly unknown[];
  /** The paginated SDK call (accepts pagination + arbitrary filter params). */
  fetch: (params: Record<string, unknown>) => Promise<Paginated<T>>;
  /** Route path this list lives on (for URL sync). */
  basePath: string;
  /** Filter param keys this list understands (besides q/page/sort/dir). */
  filterKeys: readonly string[];
  defaultSort: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Drives a master-data list: reads state from the URL (deep-linkable), issues a
 * paginated SDK query via TanStack Query (previous page kept during fetch to
 * avoid layout jumps), and writes state changes back to the URL. No `fetch`.
 */
export function useListQuery<T>(opts: UseListQueryOptions<T>) {
  const { queryKey, fetch, basePath, filterKeys, defaultSort, limit = 20, enabled = true } = opts;
  const search = useSearch({ strict: false }) as ListSearch;
  const navigate = useNavigate();

  const page = search.page ?? 1;
  const q = search.q ?? '';
  const sort = search.sort ?? defaultSort;
  const dir: SortDir = search.dir ?? 'desc';
  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    for (const key of filterKeys) {
      const v = search[key];
      if (typeof v === 'string' && v) f[key] = v;
    }
    return f;
  }, [search, filterKeys]);

  const params = useMemo(
    () => ({ page, limit, sortBy: sort, sortDir: dir, ...(q ? { search: q } : {}), ...filters }),
    [page, limit, sort, dir, q, filters],
  );

  const query = useQuery({
    queryKey: [...queryKey, params],
    queryFn: () => fetch(params),
    enabled,
    placeholderData: keepPreviousData,
  });

  const update = useCallback(
    (patch: Partial<ListSearch>, resetPage = true) => {
      navigate({
        to: basePath,
        search: (prev: ListSearch) => {
          const next: ListSearch = { ...prev, ...patch };
          if (resetPage && !('page' in patch)) next.page = 1;
          // Drop empty values so the URL stays clean.
          for (const k of Object.keys(next)) {
            const val = next[k];
            if (val === undefined || val === '' || (k === 'page' && val === 1)) delete next[k];
          }
          return next;
        },
        replace: true,
      });
    },
    [navigate, basePath],
  );

  return {
    ...query,
    items: query.data?.items ?? [],
    meta: query.data?.meta,
    // Current state
    page, q, sort, dir, filters,
    // Mutators (all URL-synced)
    setSearch: (value: string) => update({ q: value || undefined }),
    setPage: (p: number) => update({ page: p }, false),
    setFilter: (key: string, value: string) => update({ [key]: value || undefined }),
    setSort: (field: string) =>
      update({ sort: field, dir: sort === field && dir === 'desc' ? 'asc' : 'desc' }),
    isEmpty: !query.isLoading && (query.data?.items.length ?? 0) === 0,
  };
}

export type ListQuery<T> = ReturnType<typeof useListQuery<T>>;
