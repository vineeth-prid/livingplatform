import type { BadgeProps } from '@living/ui';
import type { Permission, WorkOrderStatus } from '@living/types';

import { createWorkflow } from '../operations';

type Tone = NonNullable<BadgeProps['tone']>;

export const WO_TONES: Record<string, Tone> = {
  PENDING_APPROVAL: 'warning', APPROVED: 'info', REJECTED: 'danger',
  DRAFT: 'neutral', ASSIGNED: 'brand', ACCEPTED: 'brand', IN_PROGRESS: 'warning',
  ON_HOLD: 'neutral', COMPLETED: 'info', VERIFIED: 'success', CLOSED: 'neutral', CANCELLED: 'danger',
};

export const WO_STATUSES = [
  'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
  'DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED',
] as const;

/** Origins a Work Order can come from — every WO carries one prominently. */
export const WO_ORIGINS = ['MANUAL', 'TICKET', 'SERVICE_REQUEST', 'PREVENTIVE_MAINTENANCE', 'AMC'] as const;

export const WO_ORIGIN_LABEL: Record<string, string> = {
  MANUAL: 'Manual', TICKET: 'Ticket', SERVICE_REQUEST: 'Service request',
  PREVENTIVE_MAINTENANCE: 'Maintenance plan', AMC: 'AMC',
};

export const WO_ORIGIN_TONES: Record<string, Tone> = {
  MANUAL: 'danger', TICKET: 'brand', SERVICE_REQUEST: 'info',
  PREVENTIVE_MAINTENANCE: 'success', AMC: 'warning',
};

export const WO_KANBAN = [
  { status: 'DRAFT', label: 'Draft' },
  { status: 'ASSIGNED', label: 'Assigned' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'COMPLETED', label: 'Completed' },
  { status: 'VERIFIED', label: 'Verified' },
] as const satisfies readonly { status: WorkOrderStatus; label: string }[];

const permissionFor = (to: WorkOrderStatus): Permission =>
  to === 'IN_PROGRESS' ? 'workorder:start'
    : to === 'COMPLETED' ? 'workorder:complete'
    : to === 'CLOSED' ? 'workorder:close'
    : to === 'VERIFIED' ? 'workorder:verify'
    : to === 'APPROVED' || to === 'REJECTED' ? 'workorder:approve'
    : 'workorder:update';

/**
 * Mirrors the backend WorkOrderStatusService. VERIFIED is **excluded from the
 * status menu** — it goes through the dedicated verify action (with remarks),
 * enforcing verify-before-close: CLOSED is only reachable from VERIFIED.
 */
export const woWorkflow = createWorkflow<WorkOrderStatus>({
  transitions: {
    PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['ASSIGNED', 'CANCELLED'],
    REJECTED: [],
    DRAFT: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
    ACCEPTED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
    ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
    COMPLETED: ['VERIFIED', 'IN_PROGRESS', 'CANCELLED'],
    VERIFIED: ['CLOSED', 'IN_PROGRESS'],
    CLOSED: [],
    CANCELLED: [],
  },
  permissionFor,
  // VERIFIED via the verify action; APPROVED/REJECTED via the approve/reject actions.
  excludeFromMenu: ['VERIFIED', 'APPROVED', 'REJECTED'],
  label: (from, to) => {
    if (to === 'IN_PROGRESS' && (from === 'COMPLETED' || from === 'VERIFIED')) return 'Reopen';
    switch (to) {
      case 'PENDING_APPROVAL': return 'Submit for approval';
      case 'APPROVED': return 'Approve';
      case 'REJECTED': return 'Reject';
      case 'DRAFT': return 'Move to draft';
      case 'ASSIGNED': return 'Mark assigned';
      case 'ACCEPTED': return 'Accept';
      case 'IN_PROGRESS': return 'Start work';
      case 'ON_HOLD': return 'Put on hold';
      case 'COMPLETED': return 'Mark complete';
      case 'VERIFIED': return 'Verify';
      case 'CLOSED': return 'Close';
      case 'CANCELLED': return 'Cancel';
    }
  },
  tone: (to) => (to === 'CANCELLED' ? 'danger' : to === 'COMPLETED' || to === 'CLOSED' ? 'primary' : 'default'),
});
