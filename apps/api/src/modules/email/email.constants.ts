/** BullMQ queue + job names for the Email Service. */
export const EMAIL_QUEUE = 'email';
export const EMAIL_DLQ = 'email-dead-letter';
export const EMAIL_JOB = 'send-email';

/**
 * Canonical template identifiers. A template maps to
 * `templates/emails/<name>.hbs`. Business/notification code references these,
 * never raw HTML. Names mirror the Notification Engine's future events.
 */
export const EMAIL_TEMPLATES = {
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

export type EmailTemplateName = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES];
