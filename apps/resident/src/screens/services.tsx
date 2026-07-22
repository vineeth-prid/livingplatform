import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { Card, EmptyState, Skeleton } from '@living/ui';
import type { Service } from '@living/types';

import { living } from '../lib/living';
import { CreateRequestSheet } from '../create-request-sheet';
import { ScreenHeader } from '../shell';

/** Browse the community's services and request one in a bottom sheet. */
export function ServicesScreen() {
  const [picked, setPicked] = useState<Service | null>(null);
  const q = useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => living.serviceRequest.listServices({ activeOnly: true }),
  });

  return (
    <div>
      <ScreenHeader title="Services" subtitle="Book help" />
      <div className="px-4">
        {q.isLoading ? (
          <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState icon={Wrench} title="No services yet" description="Your community hasn’t published services." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(q.data ?? []).map((s) => (
              <button key={s.id} type="button" onClick={() => setPicked(s)}
                className="text-left focus-visible:outline-none focus-visible:shadow-ring rounded-card">
                <Card variant="elevated" className="flex h-full flex-col gap-2 transition-shadow active:shadow-md">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-brand"
                    style={s.color ? { backgroundColor: `color-mix(in oklab, ${s.color} 16%, transparent)`, color: s.color } : undefined}>
                    <Wrench className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-strong">{s.name}</p>
                    {s.estimatedDurationMinutes != null && <p className="text-xs text-subtle">~{s.estimatedDurationMinutes} min</p>}
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateRequestSheet
        open={!!picked}
        onOpenChange={(o) => { if (!o) setPicked(null); }}
        mode="service"
        serviceId={picked?.id}
        serviceName={picked?.name}
      />
    </div>
  );
}
