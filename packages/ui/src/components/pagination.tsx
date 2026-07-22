import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@living/types';

import { Button } from './button';

/** Compact pager bound to the API's PageMeta. */
export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, total } = meta;
  return (
    <div className="flex items-center justify-between gap-4 pt-3">
      <p className="text-sm text-muted">
        Page <span className="font-medium text-body">{page}</span> of {totalPages}
        <span className="mx-2 text-border">·</span>
        <span data-numeric>{total}</span> total
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
