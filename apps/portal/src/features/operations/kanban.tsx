import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '@living/ui/motion';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { Card, Skeleton, toast } from '@living/ui';
import { formatDate } from '@living/utils';

import type { Workflow } from './workflow';

export interface KanbanColumn<S extends string> {
  status: S;
  label: string;
}

export interface KanbanItem<S extends string> {
  id: string;
  status: S;
  number: string;
  title: string;
  priority?: string;
  subtitle?: string;
  createdAt: string;
}

/**
 * Generic operations Kanban: items grouped into status columns; cards open the
 * detail; a per-card quick-menu moves an item to any valid, permitted next
 * status via the module's workflow + a supplied `changeStatus`.
 */
export function OperationsKanban<S extends string>({
  items, columns, workflow, loading, basePath, changeStatus, renderPriority, invalidateKey,
}: {
  items: KanbanItem<S>[];
  columns: KanbanColumn<S>[];
  workflow: Workflow<S>;
  loading: boolean;
  basePath: string;
  changeStatus: (id: string, to: S) => Promise<unknown>;
  renderPriority?: (priority: string) => React.ReactNode;
  invalidateKey: readonly unknown[];
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useAuth();
  const permissions = session?.permissions ?? [];

  const byStatus = useMemo(() => {
    const map = new Map<S, KanbanItem<S>[]>();
    for (const c of columns) map.set(c.status, []);
    for (const it of items) map.get(it.status)?.push(it);
    return map;
  }, [items, columns]);

  async function move(id: string, number: string, to: S) {
    try {
      await changeStatus(id, to);
      await qc.invalidateQueries({ queryKey: invalidateKey });
      toast.success(`Moved ${number}`);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not move');
    }
  }

  return (
    <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-4 overflow-x-auto pb-2">
      {columns.map((col) => {
        const list = byStatus.get(col.status) ?? [];
        return (
          <section key={col.status} className="flex min-w-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">{col.label}</span>
              <span className="font-mono text-xs text-subtle" data-numeric>{list.length}</span>
            </div>
            <motion.div variants={listContainer} initial="initial" animate="animate" className="flex flex-col gap-2">
              {loading
                ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)
                : list.map((it) => {
                    const actions = workflow.allowedActions(it.status, permissions);
                    return (
                      <motion.div key={it.id} variants={listItem}>
                        <Card
                          variant="elevated"
                          className="cursor-pointer p-3 transition-shadow hover:shadow-md"
                          onClick={() => navigate({ to: `${basePath}/${it.id}` })}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-subtle">{it.number}</span>
                            {it.priority && renderPriority?.(it.priority)}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm font-medium text-strong">{it.title}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted">
                            <span>{it.subtitle ?? '—'}</span>
                            <span>{formatDate(it.createdAt)}</span>
                          </div>
                          {actions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                              {actions.slice(0, 2).map((a) => (
                                <button
                                  key={a.to}
                                  type="button"
                                  onClick={() => void move(it.id, it.number, a.to)}
                                  className="rounded-md bg-sunken px-2 py-0.5 text-2xs font-medium text-muted transition-colors hover:bg-tint hover:text-brand"
                                >
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </Card>
                      </motion.div>
                    );
                  })}
              {!loading && list.length === 0 && (
                <div className="rounded-card border border-dashed border-border-subtle py-6 text-center text-xs text-subtle">Empty</div>
              )}
            </motion.div>
          </section>
        );
      })}
    </div>
  );
}
