/** Shared BullMQ queue + job names for the Notification Engine (all channels). */
export const NOTIFICATION_QUEUE = 'notifications';
export const NOTIFICATION_DLQ = 'notifications-dead-letter';
export const NOTIFICATION_JOB = 'send-notification';

/**
 * Canonical template identifiers, shared across channels. A template maps to
 * `core/templates/emails/<name>.hbs` for email; a channel that renders
 * differently (e.g. WhatsApp text) reuses the same variables. Names mirror the
 * Notification Engine's events. (Preserved verbatim from the Email sprint.)
 */
export const NOTIFICATION_TEMPLATES = {
  GENERIC: 'generic',
  EMAIL_VERIFICATION: 'email-verification',
  PASSWORD_RESET: 'password-reset',
  RESIDENT_INVITED: 'resident-invited',
  RESIDENT_APPROVED: 'resident-approved',
  TICKET_ASSIGNED: 'ticket-assigned',
  TICKET_UPDATED: 'ticket-updated',
  TICKET_CLOSED: 'ticket-closed',
  SERVICE_REQUESTED: 'service-requested',
  WORK_ORDER_CREATED: 'work-order-created',
  WORK_ORDER_COMPLETED: 'work-order-completed',
  OTP_REQUESTED: 'otp-requested',
} as const;

export type NotificationTemplateName =
  (typeof NOTIFICATION_TEMPLATES)[keyof typeof NOTIFICATION_TEMPLATES];

/** Channels the engine can route to (extend as channels are added). */
export const NOTIFICATION_CHANNELS = ['email', 'whatsapp'] as const;
