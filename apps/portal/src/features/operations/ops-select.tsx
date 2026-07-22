import { forwardRef } from 'react';

/** Native select styled to match Living inputs, wired for RHF's register() spread. */
export const OpsSelect = forwardRef<
  HTMLSelectElement,
  {
    label: string;
    error?: string;
    options: { value: string; label: string }[];
    placeholder?: string;
  } & React.SelectHTMLAttributes<HTMLSelectElement>
>(({ label, error, options, placeholder, ...rest }, ref) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-strong">{label}</span>
    <select
      ref={ref}
      className="h-11 rounded-control border border-border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring"
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {error && <span className="text-sm text-danger-fg">{error}</span>}
  </label>
));
OpsSelect.displayName = 'OpsSelect';
