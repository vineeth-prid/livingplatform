import { type ComponentType, type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@living/utils';

/** Calm placeholder for empty/first-run screens. Never a dead end. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-border px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-tint">
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <h3 className="font-display text-h4 tracking-tight text-strong">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
