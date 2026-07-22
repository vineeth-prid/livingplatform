import { type ReactNode } from 'react';
import { cn } from '@living/utils';

/** Horizontal toolbar for search + filter controls above a list/table. */
export function FilterBar({
  children,
  className,
  right,
}: {
  children: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** Native select styled to match inputs — a lean filter control. */
export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cn(
        'h-10 rounded-control border border-border bg-raised px-3 pr-8 text-sm text-strong',
        'outline-none transition-shadow focus-visible:shadow-ring cursor-pointer',
        className,
      )}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
