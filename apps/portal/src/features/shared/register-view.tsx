import { useEffect, useState } from 'react';
import { LayoutGrid, Table2 } from 'lucide-react';
import { cn } from '@living/utils';

export type RegisterView = 'table' | 'card';

/** Local, persisted table/card preference for a register (assets, plans, contracts). */
export function useCardView(storageKey: string): [RegisterView, (v: RegisterView) => void] {
  const key = `living.${storageKey}.view`;
  const [view, setView] = useState<RegisterView>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem(key) as RegisterView)) || 'table');
  useEffect(() => { localStorage.setItem(key, view); }, [key, view]);
  return [view, setView];
}

/** Table/card segmented toggle, shared by every register. */
export function RegisterViewToggle({ view, onChange }: { view: RegisterView; onChange: (v: RegisterView) => void }) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex items-center gap-0.5 rounded-pill bg-sunken p-0.5">
      {([['table', Table2, 'Table'], ['card', LayoutGrid, 'Cards']] as const).map(([v, Icon, label]) => (
        <button key={v} role="radio" aria-checked={view === v} aria-label={label} onClick={() => onChange(v)}
          className={cn('flex h-8 w-8 items-center justify-center rounded-full transition-colors',
            view === v ? 'bg-card text-strong shadow-xs' : 'text-subtle hover:text-body')}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
