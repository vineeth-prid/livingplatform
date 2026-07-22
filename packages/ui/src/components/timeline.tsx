import { type ReactNode } from 'react';
import { cn } from '@living/utils';

export interface TimelineItem {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  timestamp?: ReactNode;
  icon?: ReactNode;
}

/**
 * Structured vertical timeline / activity feed. The backend stores structured
 * events (type + actor + reference); the app composes the human title and
 * passes items here.
 */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('relative flex flex-col', className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span className="absolute left-[11px] top-6 bottom-0 w-px bg-border-subtle" aria-hidden />
            )}
            <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tint text-brand">
              {item.icon ?? <span className="h-2 w-2 rounded-full bg-brand" />}
            </span>
            <div className="flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-strong">{item.title}</p>
                {item.timestamp && (
                  <time className="shrink-0 text-xs text-subtle">{item.timestamp}</time>
                )}
              </div>
              {item.meta && <div className="mt-0.5 text-sm text-muted">{item.meta}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
