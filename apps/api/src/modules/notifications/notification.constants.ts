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
  // Sprint 11 — billing, payments and the community-life event set.
  TICKET_CREATED: 'ticket-created',
  SERVICE_ASSIGNED: 'service-assigned',
  WORK_ORDER_ASSIGNED: 'work-order-assigned',
  MAINTENANCE_DUE: 'maintenance-due',
  PAYMENT_SUCCESS: 'payment-success',
  VISITOR_PASS: 'visitor-pass',
  VISITOR_APPROVED: 'visitor-approved',
  BOOKING_CONFIRMED: 'booking-confirmed',
  ANNOUNCEMENT: 'announcement',
  WELCOME: 'welcome',
} as const;

export type NotificationTemplateName =
  (typeof NOTIFICATION_TEMPLATES)[keyof typeof NOTIFICATION_TEMPLATES];

/** Channels the engine can route to (extend as channels are added). */
export const NOTIFICATION_CHANNELS = ['email', 'whatsapp'] as const;
