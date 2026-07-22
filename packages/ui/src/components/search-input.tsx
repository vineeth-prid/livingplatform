import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@living/utils';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
}

/** Search field with a leading icon and a clear affordance. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onValueChange, placeholder = 'Search…', ...props }, ref) => (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-control border border-border bg-raised px-3',
        'transition-shadow focus-within:shadow-ring',
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-subtle" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-strong placeholder:text-subtle outline-none [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          className="rounded p-0.5 text-subtle transition-colors hover:text-strong"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  ),
);
SearchInput.displayName = 'SearchInput';
