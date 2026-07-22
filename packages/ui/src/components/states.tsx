import { AlertTriangle } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { cn } from '@living/utils';

import { Button } from './button';
import { Spinner } from './spinner';

/** Full-region loading state. */
export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-14', className)}>
      <Spinner />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

/** Error state with a calm, specific message and a retry affordance. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message =
    error instanceof LivingApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Something went wrong.';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-[var(--danger-bg)] bg-[var(--danger-bg)]/40 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--danger-bg)]">
        <AlertTriangle className="h-5 w-5 text-danger-fg" />
      </div>
      <h3 className="text-h4 font-semibold text-strong">We hit a snag</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
