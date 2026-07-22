import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '@living/ui/motion';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { Card, Skeleton, toast } from '@living/ui';
import { formatDate } from '@living/utils';
import type { Ticket, TicketStatus } from '@living/types';

import { living } from '../../lib/living';
import { PriorityBadge } from './ticket-badges';
import { allowedStatusActions } from './status-workflow';

const COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: 'OPEN', label: 'Open' },
  { status: 'ASSIGNED', label: 'Assigned' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'ON_HOLD', label: 'On hold' },
  { status: 'RESOLVED', label: 'Resolved' },
];

/**
 * Kanban board: tickets grouped by status into columns. Cards open the detail;
 * a small quick-menu moves a ticket to any valid, permitted next status
 * (respecting the same workflow as the detail) — a board without drag-and-drop
 * that still triages fast.
 */
export function TicketKanban({ tickets, loading }: { tickets: Ticket[]; loading: boolean }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const qc = useQueryClient();
  const permissions = session?.permissions ?? [];

  const byStatus = useMemo(() => {
    const map = new Map<TicketStatus, Ticket[]>();
    for (const c of COLUMNS) map.set(c.status, []);
    for (const t of tickets) map.get(t.status)?.push(t);
    return map;
  }, [tickets]);

  async function move(t: Ticket, to: TicketStatus) {
    try {
      await living.ticket.changeStatus(t.id, to);
      await qc.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(`Moved ${t.ticketNumber}`);
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not move ticket');
    }
  }

  return (
    <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-4 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const items = byStatus.get(col.status) ?? [];
        return (
          <section key={col.status} className="flex min-w-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">{col.label}</span>
              <span className="font-mono text-xs text-subtle" data-numeric>{items.length}</span>
            </div>
            <motion.div variants={listContainer} initial="initial" animate="animate" className="flex flex-col gap-2">
              {loading
                ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-card" />)
                : items.map((t) => {
                    const actions = allowedStatusActions(t.status, permissions);
                    return (
                      <motion.div key={t.id} variants={listItem}>
                        <Card
                          variant="elevated"
                          className="cursor-pointer p-3 transition-shadow hover:shadow-md"
                          onClick={() => navigate({ to: `/tickets/${t.id}` })}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-subtle">{t.ticketNumber}</span>
                            <PriorityBadge priority={t.priority} />
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm font-medium text-strong">{t.title}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted">
                            <span>{t.unit?.unitNumber ? <span className="font-mono">{t.unit.unitNumber}</span> : '—'}</span>
                            <span>{formatDate(t.createdAt)}</span>
                          </div>
                          {actions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                              {actions.slice(0, 2).map((a) => (
                                <button
                                  key={a.to}
                                  type="button"
                                  onClick={() => void move(t, a.to)}
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
              {!loading && items.length === 0 && (
                <div className="rounded-card border border-dashed border-border-subtle py-6 text-center text-xs text-subtle">
                  Empty
                </div>
              )}
            </motion.div>
          </section>
        );
      })}
    </div>
  );
}
