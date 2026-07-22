import { type ReactNode } from 'react';
import { cn } from '@living/utils';

import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';
import { Table, TBody, TD, TH, THead, TR } from './table';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  skeletonRows?: number;
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Presentational data table — the app owns fetching/sorting/pagination (via the
 * SDK + query hooks) and passes rows in. Handles loading skeletons and empty
 * state so every list screen looks identical.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  onRowClick,
  empty,
  skeletonRows = 6,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <Table>
        <THead>
          <TR>
            {columns.map((c) => (
              <TH key={c.key} className={c.align && alignClass[c.align]}>
                {c.header}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {Array.from({ length: skeletonRows }).map((_, i) => (
            <TR key={i}>
              {columns.map((c) => (
                <TD key={c.key}>
                  <Skeleton className="h-4 w-full max-w-[160px]" />
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    );
  }

  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  }

  return (
    <Table>
      <THead>
        <TR>
          {columns.map((c) => (
            <TH key={c.key} className={c.align && alignClass[c.align]}>
              {c.header}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => (
          <TR
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(onRowClick && 'cursor-pointer')}
          >
            {columns.map((c) => (
              <TD key={c.key} className={cn(c.align && alignClass[c.align], c.className)}>
                {c.cell(row)}
              </TD>
            ))}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
