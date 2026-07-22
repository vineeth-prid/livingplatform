import type { Permission, TicketStatus } from '@living/types';

/**
 * Client mirror of the backend TicketStatusService. Drives which status actions
 * are offered (valid transitions only) and which permission each needs — so the
 * UI never shows an action the backend would reject. Pure + tested.
 */
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'OPEN', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
  CANCELLED: [],
};

/** The permission required to move a ticket INTO a given status. */
export function permissionForStatus(to: TicketStatus): Permission {
  if (to === 'RESOLVED') return 'ticket:resolve';
  if (to === 'CLOSED') return 'ticket:close';
  return 'ticket:update';
}

export interface StatusAction {
  to: TicketStatus;
  label: string;
  permission: Permission;
  tone: 'default' | 'primary' | 'danger';
}

function label(from: TicketStatus, to: TicketStatus): string {
  if (to === 'IN_PROGRESS' && (from === 'RESOLVED' || from === 'CLOSED')) return 'Reopen';
  switch (to) {
    case 'OPEN': return 'Move to open';
    case 'ASSIGNED': return 'Mark assigned';
    case 'IN_PROGRESS': return 'Start progress';
    case 'ON_HOLD': return 'Put on hold';
    case 'RESOLVED': return 'Resolve';
    case 'CLOSED': return 'Close';
    case 'CANCELLED': return 'Cancel';
  }
}

function toneFor(to: TicketStatus): StatusAction['tone'] {
  if (to === 'CANCELLED') return 'danger';
  if (to === 'RESOLVED' || to === 'CLOSED') return 'primary';
  return 'default';
}

export function isTerminal(status: TicketStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Valid + permitted transitions from `from`, given the user's permissions. */
export function allowedStatusActions(
  from: TicketStatus,
  permissions: readonly string[],
): StatusAction[] {
  const held = new Set(permissions);
  return TRANSITIONS[from]
    .map((to) => ({ to, label: label(from, to), permission: permissionForStatus(to), tone: toneFor(to) }))
    .filter((a) => held.has(a.permission));
}
