import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LivingApiError } from '@living/living-sdk';
import { Button, Input, Sheet, SheetContent, toast } from '@living/ui';

export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea' | 'select';

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Two-column layout on wider screens. */
  half?: boolean;
}

type Values = Record<string, string>;

/**
 * A config-driven create/edit drawer. Forms are intentionally secondary here
 * (the sprint prioritises browsing) — a lean controlled form, no form library.
 * Reuses Sheet + Input; validates required + email; toasts API errors.
 */
export function FormDrawer({
  open, onOpenChange, title, description, fields, initial = {}, submitLabel = 'Save', onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initial?: Values;
  submitLabel?: string;
  /** Returns the created/updated record; the drawer closes on success. */
  onSubmit: (values: Values) => Promise<unknown>;
}) {
  const [values, setValues] = useState<Values>(() => seed(fields, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Re-seed when the drawer (re)opens for a different record.
  const initialKey = useMemo(() => JSON.stringify(initial), [initial]);
  useEffect(() => {
    setValues(seed(fields, initial));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, open]);

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validate(fields, values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(prune(values));
      toast.success('Saved');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof LivingApiError ? err.message : 'Could not save';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent open={open} side="right" title={title} description={description} className="w-[min(94vw,520px)]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.name} className={f.half ? '' : 'sm:col-span-2'}>
                {f.type === 'select' ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-strong">{f.label}</span>
                    <select
                      value={values[f.name] ?? ''}
                      onChange={(e) => set(f.name, e.target.value)}
                      className="h-11 rounded-control border border-border bg-raised px-3 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring"
                    >
                      <option value="">{f.placeholder ?? 'Select…'}</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {errors[f.name] && <span className="text-sm text-danger-fg">{errors[f.name]}</span>}
                  </label>
                ) : f.type === 'textarea' ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-strong">{f.label}</span>
                    <textarea
                      value={values[f.name] ?? ''}
                      onChange={(e) => set(f.name, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                      className="rounded-control border border-border bg-raised px-3 py-2 text-base text-strong outline-none transition-shadow focus-visible:shadow-ring"
                    />
                    {errors[f.name] && <span className="text-sm text-danger-fg">{errors[f.name]}</span>}
                  </label>
                ) : (
                  <Input
                    label={f.label}
                    type={f.type ?? 'text'}
                    value={values[f.name] ?? ''}
                    onChange={(e) => set(f.name, e.target.value)}
                    placeholder={f.placeholder}
                    error={errors[f.name]}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>{submitLabel}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function seed(fields: FieldDef[], initial: Values): Values {
  const v: Values = {};
  for (const f of fields) v[f.name] = initial[f.name] ?? '';
  return v;
}

function validate(fields: FieldDef[], values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const value = (values[f.name] ?? '').trim();
    if (f.required && !value) errors[f.name] = 'Required';
    else if (f.type === 'email' && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
      errors[f.name] = 'Enter a valid email';
  }
  return errors;
}

/** Drop empty strings so we don't overwrite fields with blanks. */
function prune(values: Values): Values {
  const out: Values = {};
  for (const [k, v] of Object.entries(values)) if (v.trim() !== '') out[k] = v;
  return out;
}
