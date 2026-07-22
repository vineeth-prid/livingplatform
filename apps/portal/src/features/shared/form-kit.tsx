import { type ReactNode } from 'react';
import { Button, Card } from '@living/ui';
import { cn } from '@living/utils';

/** Shared multi-section form primitives — one look across asset / plan / contract forms. */

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card variant="elevated">
      <div className="mb-4">
        <h2 className="font-display text-h4 tracking-tight text-strong">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

export const FormGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
);

export const FullWidth = ({ children }: { children: ReactNode }) => <div className="sm:col-span-2">{children}</div>;

export function SelectField({
  label, value, onChange, options, placeholder, required, error, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; required?: boolean; error?: string; disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-strong">{label}{required && <span className="text-danger-fg"> *</span>}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className={cn('h-11 rounded-control border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring disabled:opacity-60',
          error ? 'border-danger-fg' : 'border-border')}>
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span className="text-sm text-danger-fg">{error}</span>}
    </label>
  );
}

export function TextAreaField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-strong">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="rounded-control border border-border bg-raised px-3 py-2 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring" />
    </label>
  );
}

export function CheckboxField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]" />
      <span>
        <span className="text-sm font-medium text-strong">{label}</span>
        {hint && <span className="block text-xs text-subtle">{hint}</span>}
      </span>
    </label>
  );
}

/** Sticky footer with cancel + submit — shared by every multi-section form. */
export function FormFooter({
  submitLabel, submitting, disabled, onSubmit, onCancel,
}: {
  submitLabel: string; submitting?: boolean; disabled?: boolean; onSubmit: () => void; onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 border-t border-border-subtle bg-page/80 px-1 py-3 backdrop-blur">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button type="button" loading={submitting} disabled={disabled} onClick={onSubmit}>{submitLabel}</Button>
    </div>
  );
}
