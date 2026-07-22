import { useEffect, useState } from 'react';
import { KanbanSquare, Table2 } from 'lucide-react';
import { cn } from '@living/utils';

export type ViewMode = 'table' | 'kanban';

/** Local, persisted table/kanban preference for an operations list. */
export function useViewMode(key: string): [ViewMode, (v: ViewMode) => void] {
  const storageKey = `living.${key}.view`;
  const [view, setView] = useState<ViewMode>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem(storageKey) as ViewMode)) || 'table',
  );
  useEffect(() => { localStorage.setItem(storageKey, view); }, [storageKey, view]);
  return [view, setView];
}

export function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex items-center gap-0.5 rounded-pill bg-sunken p-0.5">
      {([['table', Table2, 'Table'], ['kanban', KanbanSquare, 'Kanban']] as const).map(([v, Icon, label]) => (
        <button
          key={v}
          role="radio"
          aria-checked={view === v}
          aria-label={label}
          onClick={() => onChange(v)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
            view === v ? 'bg-card text-strong shadow-xs' : 'text-subtle hover:text-body',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
