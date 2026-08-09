import { useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent } from '@living/ui';

import { useWorker } from './worker';

/**
 * Switch between the communities this worker covers.
 *
 * Renders NOTHING when there is only one, which is almost everybody. The switch
 * moves the whole app: the job queue, the gate register and any work order
 * raised from here all follow the staff profile for the chosen community.
 */
export function CommunitySwitcher() {
  const { community, communities, setCommunityId } = useWorker();
  const [open, setOpen] = useState(false);

  if (communities.length < 2 || !community) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-w-[55vw] items-center gap-1.5 rounded-pill bg-sunken px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:bg-tint hover:text-brand"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{community.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          open={open}
          side="bottom"
          title="Switch community"
          description="Your jobs and the gate register follow this choice."
        >
          <ul className="flex flex-col gap-1">
            {communities.map((c) => {
              const active = c.id === community.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCommunityId(c.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-card px-3 py-3 text-left transition-colors ${
                      active ? 'bg-tint text-brand' : 'text-body hover:bg-sunken'
                    }`}
                  >
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      {c.city && <span className="block truncate text-xs text-subtle">{c.city}</span>}
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
