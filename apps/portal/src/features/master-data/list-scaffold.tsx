import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from 'lucide-react';
import { Can } from '@living/hooks';
import { debounce } from '@living/utils';
import type { Permission } from '@living/types';
import {
  Button, Card, type Column, DataTable, ErrorState, FilterBar, FilterSelect,
  PageContainer, PageHeader, PageTransition, Pagination, SearchInput,
} from '@living/ui';

import type { ListQuery } from './use-list-query';

/** A DataTable column that may be sortable via a backend field. */
export interface ListColumn<T> extends Column<T> {
  sortKey?: string;
}

export interface ListFilter {
  key: string;
  placeholder: string;
  options: { value: string; label: string }[];
}

interface ListScaffoldProps<T> {
  title: string;
  description?: string;
  query: ListQuery<T>;
  columns: ListColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  filters?: ListFilter[];
  /** Permission required to see the "New" button. */
  createPermission?: Permission;
  onCreate?: () => void;
  createLabel?: string;
  headerActions?: ReactNode;
  /** Replace the default table+pagination body (e.g. a Kanban board). Filters,
   *  search and header stay shared, so no list plumbing is duplicated. */
  renderContent?: ReactNode;
}

/**
 * The one list experience reused by every master-data module: search + quick
 * filters + sortable DataTable + pagination + loading/empty/error, all deep-
 * linked through the URL. Modules supply columns/filters/handlers only.
 */
export function ListScaffold<T>({
  title, description, query, columns, rowKey, onRowClick, searchPlaceholder,
  filters = [], createPermission, onCreate, createLabel = 'New', headerActions, renderContent,
}: ListScaffoldProps<T>) {
  // Local input value for instant typing; the query updates debounced + URL-synced.
  const [text, setText] = useState(query.q);
  const debouncedSearch = useMemo(
    () => debounce((v: string) => query.setSearch(v), 250),
    [query.setSearch],
  );

  const tableColumns: Column<T>[] = columns.map((c) => ({
    ...c,
    header: c.sortKey ? (
      <SortHeader
        label={c.header}
        active={query.sort === c.sortKey}
        dir={query.dir}
        onClick={() => query.setSort(c.sortKey!)}
      />
    ) : (
      c.header
    ),
  }));

  return (
    <PageTransition>
      <PageContainer>
        <PageHeader
          eyebrow="Master data"
          title={title}
          description={description}
          actions={
            <>
              {headerActions}
              {onCreate && createPermission && (
                <Can perm={createPermission}>
                  <Button onClick={onCreate}>
                    <Plus className="h-4 w-4" /> {createLabel}
                  </Button>
                </Can>
              )}
            </>
          }
        />

        <FilterBar className="mb-4">
          <SearchInput
            value={text}
            onValueChange={(v) => {
              setText(v);
              debouncedSearch(v);
            }}
            placeholder={searchPlaceholder ?? 'Search…'}
            className="w-full max-w-xs"
          />
          {filters.map((f) => (
            <FilterSelect
              key={f.key}
              value={query.filters[f.key] ?? ''}
              onValueChange={(v) => query.setFilter(f.key, v)}
              options={f.options}
              placeholder={f.placeholder}
            />
          ))}
        </FilterBar>

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : renderContent ? (
          renderContent
        ) : (
          <>
            <Card variant="elevated" padded={false} className="overflow-hidden">
              <DataTable
                columns={tableColumns}
                rows={query.items}
                rowKey={rowKey}
                loading={query.isLoading}
                onRowClick={onRowClick}
              />
            </Card>
            {query.meta && query.meta.total > 0 && (
              <Pagination meta={query.meta} onPageChange={query.setPage} />
            )}
          </>
        )}
      </PageContainer>
    </PageTransition>
  );
}

function SortHeader({
  label, active, dir, onClick,
}: {
  label: ReactNode; active: boolean; dir: 'asc' | 'desc'; onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-body focus-visible:outline-none focus-visible:text-body"
    >
      {label}
      <Icon className={`h-3 w-3 ${active ? 'text-brand' : 'text-subtle opacity-60'}`} />
    </button>
  );
}
