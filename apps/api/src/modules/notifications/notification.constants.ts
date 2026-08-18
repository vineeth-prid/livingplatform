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
  /** Sent to the community's approvers when a resident requests a visitor. */
  VISITOR_PENDING: 'visitor-pending',
  VISITOR_APPROVED: 'visitor-approved',
  BOOKING_CONFIRMED: 'booking-confirmed',
  ANNOUNCEMENT: 'announcement',
  WELCOME: 'welcome',
  // Sprint 13 — Gate Management. Used for the email/WhatsApp renderings of a
  // gate arrival; in-app and push carry a structured payload instead.
  GATE_ENTRY_ARRIVED: 'gate-entry-arrived',
  /**
   * An admin-issued temporary password, sent to the account it belongs to.
   * The password was previously shown once on screen and nowhere else, so
   * whoever reset it had to relay it out of band.
   */
  ADMIN_TEMPORARY_PASSWORD: 'admin-temporary-password',
} as const;

export type NotificationTemplateName =
  (typeof NOTIFICATION_TEMPLATES)[keyof typeof NOTIFICATION_TEMPLATES];

/** Channels the engine can route to (extend as channels are added). */
export const NOTIFICATION_CHANNELS = ['email', 'whatsapp', 'inapp', 'push'] as const;
