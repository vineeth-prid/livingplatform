import { forwardRef, useId, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@living/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

/** Labelled field with hint, error and leading/trailing adornments. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leading, trailing, id, disabled, type, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [revealed, setRevealed] = useState(false);

    /*
      Every password field gets a reveal toggle, here rather than at each call
      site — a one-time password read off a screen and typed on a phone is the
      common case in this product, and there were no toggles anywhere.
      Typing stays masked by default; revealing is a deliberate act.
    */
    const isPassword = type === 'password';
    const effectiveType = isPassword && revealed ? 'text' : type;
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-strong">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center gap-2 rounded-control border bg-raised px-3 h-11',
            'transition-[box-shadow,border-color] duration-fast',
            'focus-within:shadow-ring',
            error ? 'border-danger-solid' : 'border-border',
            disabled && 'opacity-[0.42] pointer-events-none',
          )}
        >
          {leading && <span className="text-muted shrink-0">{leading}</span>}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            type={effectiveType}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cn(
              'w-full bg-transparent text-base text-strong placeholder:text-subtle',
              'outline-none',
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              aria-pressed={revealed}
              tabIndex={-1}
              className="shrink-0 rounded p-0.5 text-muted transition-colors hover:text-strong focus-visible:shadow-ring"
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
          {trailing && <span className="text-muted shrink-0">{trailing}</span>}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-sm text-danger-fg">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-sm text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
