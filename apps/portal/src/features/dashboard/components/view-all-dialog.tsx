import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { EmptyState, Pagination, SearchInput, Sheet, SheetContent } from '@living/ui';

const PER_PAGE = 20;

/**
 * "View all" for a dashboard feed: the full list in a pop-up, searchable (by
 * flat number, reference or title — whatever `searchText` returns) and paged.
 */
export function ViewAllDialog<T>({
  open, onOpenChange, title, items, searchText, renderItem, rowKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: T[];
  searchText: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  rowKey: (item: T) => string;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((i) => searchText(i).toLowerCase().includes(q)) : items),
    [items, q, searchText],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  useEffect(() => setPage(1), [q, open]);
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} title={title} description={`${items.length} entries · search by flat number, reference or title`}>
        <div className="flex flex-col gap-4">
          <SearchInput value={search} onValueChange={setSearch} placeholder="Flat (e.g. A-101), number or title…" className="w-full sm:w-80" />
          {rows.length === 0 ? (
            <EmptyState title="Nothing matches" description="Try a flat number like A-101, or part of a title." />
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {rows.map((i) => <li key={rowKey(i)} className="py-1">{renderItem(i)}</li>)}
            </ul>
          )}
          {filtered.length > PER_PAGE && (
            <Pagination meta={{ page, limit: PER_PAGE, total: filtered.length, totalPages }} onPageChange={setPage} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
