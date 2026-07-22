import type { BadgeProps } from '@living/ui';
import type { Permission, ServiceRequestStatus } from '@living/types';

import { createWorkflow } from '../operations';

type Tone = NonNullable<BadgeProps['tone']>;

/** Service-request status → badge tone. */
export const SR_TONES: Record<string, Tone> = {
  REQUESTED: 'info', ASSIGNED: 'brand', ACCEPTED: 'brand', SCHEDULED: 'info',
  IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'neutral', REJECTED: 'danger',
};

export const SR_STATUSES = [
  'REQUESTED', 'ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED',
] as const;

/** Kanban columns (active lane; terminal states omitted from the board). */
export const SR_KANBAN = [
  { status: 'REQUESTED', label: 'Requested' },
  { status: 'ASSIGNED', label: 'Assigned' },
  { status: 'ACCEPTED', label: 'Accepted' },
  { status: 'SCHEDULED', label: 'Scheduled' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'COMPLETED', label: 'Completed' },
] as const satisfies readonly { status: ServiceRequestStatus; label: string }[];

const permissionFor = (to: ServiceRequestStatus): Permission =>
  to === 'COMPLETED' ? 'service:complete' : to === 'CANCELLED' ? 'service:cancel' : 'service:update';

/** Mirrors the backend ServiceRequestStatusService transition map. */
export const srWorkflow = createWorkflow<ServiceRequestStatus>({
  transitions: {
    REQUESTED: ['ASSIGNED', 'CANCELLED', 'REJECTED'],
    ASSIGNED: ['ACCEPTED', 'REJECTED', 'CANCELLED', 'REQUESTED'],
    ACCEPTED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
    SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
    REJECTED: [],
  },
  permissionFor,
  label: (_from, to) => {
    switch (to) {
      case 'REQUESTED': return 'Return to requested';
      case 'ASSIGNED': return 'Mark assigned';
      case 'ACCEPTED': return 'Accept';
      case 'SCHEDULED': return 'Schedule';
      case 'IN_PROGRESS': return 'Start work';
      case 'COMPLETED': return 'Mark complete';
      case 'CANCELLED': return 'Cancel';
      case 'REJECTED': return 'Reject';
    }
  },
  tone: (to) => (to === 'CANCELLED' || to === 'REJECTED' ? 'danger' : to === 'COMPLETED' ? 'primary' : 'default'),
});
