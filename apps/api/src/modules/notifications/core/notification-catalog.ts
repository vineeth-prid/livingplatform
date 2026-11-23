import { NotificationEvent } from '@prisma/client';

import { NOTIFICATION_TEMPLATES } from '../notification.constants';

/**
 * The variable registry and default WhatsApp wording for every routed
 * notification — the ONE place that says which values a message may use,
 * which of them it cannot be sent without, and what the preview shows.
 *
 * Email bodies stay in `templates/emails/<name>.hbs`; WhatsApp gets its own
 * plain-text wording here, because a WhatsApp message is not an email with the
 * HTML stripped off (that is how "Hello ," and "is now ." reached residents).
 *
 * Branding values (community_name, signature, support_email, support_phone)
 * are supplied by NotificationBrandingResolver for every message, so templates
 * never hardcode an identity.
 */

export interface VariableSpec {
  label: string;
  /** What the editor preview substitutes. */
  sample: string;
}

export const VARIABLES = {
  recipient_name: { label: 'Recipient name', sample: 'Vineeth' },
  community_name: { label: 'Community name', sample: 'ABC Residency' },
  signature: { label: 'Signature', sample: 'ABC Residency Management Team' },
  support_email: { label: 'Support email', sample: 'office@abcresidency.in' },
  support_phone: { label: 'Support phone', sample: '+91 98200 00000' },

  unit_number: { label: 'Apartment / unit', sample: 'A-101' },
  billing_period: { label: 'Billing period', sample: 'December 2026' },
  amount: { label: 'Amount', sample: 'INR 2,500.00' },
  due_date: { label: 'Due date', sample: '10 Dec 2026' },
  invoice_number: { label: 'Invoice number', sample: 'INV-2026-0142' },
  payment_link: { label: 'Payment link', sample: 'https://resident.example.com/maintenance' },

  payment_purpose: { label: 'Payment purpose', sample: 'Maintenance — INV-2026-0142' },
  payment_date: { label: 'Payment date', sample: '23 Nov 2026, 4:15 pm' },
  payment_method: { label: 'Payment method', sample: 'UPI' },
  transaction_reference: { label: 'Transaction reference', sample: 'pay_PQ8x2LmN0' },
  receipt_number: { label: 'Receipt number', sample: 'RCPT-000231' },
  receipt_link: { label: 'Receipt link', sample: 'https://resident.example.com/maintenance' },

  visitor_name: { label: 'Visitor name', sample: 'Ramesh Kumar' },
  visit_date: { label: 'Visit date', sample: '24 Nov 2026' },
  arrival_time: { label: 'Expected arrival', sample: '11:30 am' },
  pass_code: { label: 'Pass code', sample: 'AB12CD' },
  host_name: { label: 'Host', sample: 'Aisha Khan' },
  visitor_pass_link: { label: 'Visitor pass link', sample: 'https://resident.example.com/visitors' },
  approval_link: { label: 'Approval link', sample: 'https://platform.example.com/visitors' },

  facility_name: { label: 'Facility', sample: 'Clubhouse' },
  booking_date: { label: 'Booking date', sample: '28 Nov 2026' },
  time_slot: { label: 'Time slot', sample: '6:00 pm – 8:00 pm' },
  booking_status: { label: 'Booking status', sample: 'Confirmed' },
  booking_link: { label: 'Booking link', sample: 'https://resident.example.com/bookings' },

  announcement_title: { label: 'Announcement title', sample: 'Water supply shutdown on Sunday' },
  announcement_summary: { label: 'Announcement summary', sample: 'Water supply will be off from 10 am to 2 pm for tank cleaning.' },
  published_date: { label: 'Published date', sample: '23 Nov 2026' },
  announcement_link: { label: 'Announcement link', sample: 'https://resident.example.com/announcements' },

  ticket_number: { label: 'Ticket number', sample: 'TKT-000116' },
  ticket_title: { label: 'Ticket title', sample: 'Not clean' },
  ticket_description: { label: 'Ticket description', sample: 'The staircase on floor 3 has not been cleaned.' },
  created_at: { label: 'Submitted on', sample: '23 Nov 2026, 10:05 am' },
  previous_status: { label: 'Previous status', sample: 'Open' },
  status: { label: 'Current status', sample: 'In Progress' },
  update_description: {
    label: 'Update description',
    sample: 'Our maintenance team is currently working on your request. You will receive another update once there is further progress.',
  },
  updated_at: { label: 'Updated on', sample: '23 Nov 2026, 2:40 pm' },
  ticket_link: { label: 'Ticket link', sample: 'https://resident.example.com/requests/ticket/preview' },
  assigned_to: { label: 'Assigned to', sample: 'Suresh (Housekeeping)' },
  assigned_at: { label: 'Assigned on', sample: '23 Nov 2026, 11:20 am' },

  request_number: { label: 'Service request number', sample: 'SR-000042' },
  service_title: { label: 'Service', sample: 'Deep cleaning' },
  scheduled_date: { label: 'Scheduled date', sample: '25 Nov 2026' },
  request_link: { label: 'Service request link', sample: 'https://resident.example.com/requests/service/preview' },

  work_order_number: { label: 'Work order number', sample: 'WO-000009' },
  work_title: { label: 'Work description', sample: 'Replace booster pump' },
  expected_completion: { label: 'Expected completion', sample: '30 Nov 2026' },
  work_order_link: { label: 'Work order link', sample: 'https://workforce.example.com/jobs/work-order/preview' },

  reset_link: { label: 'Reset link', sample: 'https://platform.example.com/auth/reset-password?token=…' },
  expires_in: { label: 'Link expiry', sample: '1 hour' },

  username: { label: 'Username', sample: '9820000001' },
  app_link: { label: 'App link', sample: 'https://resident.example.com' },
} satisfies Record<string, VariableSpec>;

export type VariableName = keyof typeof VARIABLES;

const BRAND: VariableName[] = ['community_name', 'signature', 'support_email', 'support_phone'];

export interface TemplateSpec {
  variables: VariableName[];
  /** Without these the message is not sent — it is recorded as FAILED instead. */
  required: VariableName[];
  /** Email subject (Handlebars). */
  subject: string;
  /**
   * The default wording, in plain text with WhatsApp's *bold*. WhatsApp sends
   * it as written; email lays the same text out — "Label: value" lines become
   * a details table, a lone "Label: https://…" line a button — so neither the
   * defaults nor an admin's own wording ever involve HTML.
   */
  text: string;
}

const greeting = 'Hello{{#if recipient_name}} {{recipient_name}}{{/if}},';
const signOff = 'Regards,\n*{{signature}}*';

/** Every template the router sends, keyed by template name. */
export const TEMPLATE_SPECS: Record<string, TemplateSpec> = {
  [NOTIFICATION_TEMPLATES.MAINTENANCE_DUE]: {
    variables: ['recipient_name', 'unit_number', 'billing_period', 'amount', 'due_date', 'invoice_number', 'payment_link'],
    required: ['amount', 'due_date', 'payment_link'],
    subject: 'Maintenance payment due{{#if billing_period}} — {{billing_period}}{{/if}}',
    text: `*Maintenance Payment Reminder*

${greeting}

This is a reminder that the maintenance payment for your apartment is due.

{{#if unit_number}}Apartment: {{unit_number}}
{{/if}}{{#if billing_period}}Billing Period: {{billing_period}}
{{/if}}Amount Due: {{amount}}
Due Date: {{due_date}}
{{#if invoice_number}}Invoice: {{invoice_number}}
{{/if}}
Please complete the payment using the link below.

Pay Now: {{payment_link}}

${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.PAYMENT_SUCCESS]: {
    variables: ['recipient_name', 'amount', 'payment_purpose', 'payment_date', 'payment_method', 'transaction_reference', 'receipt_number', 'receipt_link'],
    required: ['amount', 'transaction_reference', 'payment_date'],
    subject: 'Payment received — {{amount}}',
    text: `*Payment Received Successfully*

${greeting}

We have successfully received your payment.

Amount: {{amount}}
{{#if payment_purpose}}Purpose: {{payment_purpose}}
{{/if}}Payment Date: {{payment_date}}
{{#if payment_method}}Method: {{payment_method}}
{{/if}}Transaction Reference: {{transaction_reference}}
{{#if receipt_number}}Receipt: {{receipt_number}}
{{/if}}{{#if receipt_link}}
You can view your payment receipt below.

View Receipt: {{receipt_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.VISITOR_PASS]: {
    variables: ['recipient_name', 'visitor_name', 'visit_date', 'arrival_time', 'pass_code', 'visitor_pass_link'],
    required: ['visitor_name', 'pass_code'],
    subject: 'Visitor pass for {{visitor_name}}',
    text: `*Visitor Pass Created*

${greeting}

A visitor pass has been created for your guest.

Visitor: {{visitor_name}}
{{#if visit_date}}Visit Date: {{visit_date}}
{{/if}}{{#if arrival_time}}Expected Arrival: {{arrival_time}}
{{/if}}Pass Code: *{{pass_code}}*

Please share the pass code with your visitor to show at the gate.
{{#if visitor_pass_link}}
View Visitor Pass: {{visitor_pass_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.VISITOR_PENDING]: {
    variables: ['recipient_name', 'visitor_name', 'host_name', 'unit_number', 'visit_date', 'arrival_time', 'approval_link'],
    required: ['visitor_name', 'host_name'],
    subject: 'Visitor awaiting approval — {{visitor_name}}',
    text: `*Visitor Awaiting Approval*

${greeting}

A resident has requested entry for a visitor.

Visitor: {{visitor_name}}
Host: {{host_name}}{{#if unit_number}} ({{unit_number}}){{/if}}
{{#if visit_date}}Visit Date: {{visit_date}}
{{/if}}{{#if arrival_time}}Expected Arrival: {{arrival_time}}
{{/if}}{{#if approval_link}}
Approve or reject: {{approval_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.VISITOR_APPROVED]: {
    variables: ['recipient_name', 'visitor_name', 'visit_date', 'arrival_time', 'pass_code', 'visitor_pass_link'],
    required: ['visitor_name'],
    subject: 'Visitor approved — {{visitor_name}}',
    text: `*Visitor Approved*

${greeting}

Your visitor request has been approved.

Visitor: {{visitor_name}}
{{#if visit_date}}Visit Date: {{visit_date}}
{{/if}}{{#if arrival_time}}Expected Arrival: {{arrival_time}}
{{/if}}{{#if pass_code}}Pass Code: *{{pass_code}}*
{{/if}}
Your visitor pass is ready.
{{#if visitor_pass_link}}
View Visitor Pass: {{visitor_pass_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.BOOKING_CONFIRMED]: {
    variables: ['recipient_name', 'facility_name', 'booking_date', 'time_slot', 'booking_status', 'booking_link'],
    required: ['facility_name', 'booking_date', 'time_slot'],
    subject: 'Booking confirmed — {{facility_name}}, {{booking_date}}',
    text: `*Booking Confirmed*

${greeting}

Your facility booking is confirmed.

Facility: {{facility_name}}
Date: {{booking_date}}
Time Slot: {{time_slot}}
{{#if booking_status}}Status: {{booking_status}}
{{/if}}{{#if booking_link}}
View Booking: {{booking_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.ANNOUNCEMENT]: {
    variables: ['recipient_name', 'announcement_title', 'announcement_summary', 'published_date', 'announcement_link'],
    required: ['announcement_title'],
    subject: '{{announcement_title}}',
    text: `*{{announcement_title}}*

${greeting}

{{#if announcement_summary}}{{announcement_summary}}

{{/if}}{{#if published_date}}Published: {{published_date}}
{{/if}}{{#if announcement_link}}
Read the full announcement: {{announcement_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.TICKET_CREATED]: {
    variables: ['recipient_name', 'ticket_number', 'ticket_title', 'created_at', 'status', 'ticket_link'],
    required: ['ticket_number', 'ticket_title'],
    subject: 'Request registered — {{ticket_number}}',
    text: `*Maintenance Request Created*

${greeting}

Your maintenance request has been successfully registered.

Ticket Number: {{ticket_number}}
Issue: {{ticket_title}}
{{#if created_at}}Submitted On: {{created_at}}
{{/if}}{{#if status}}Status: {{status}}
{{/if}}
Our community team will review your request and provide further updates.
{{#if ticket_link}}
Track Request: {{ticket_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.TICKET_ASSIGNED]: {
    variables: ['recipient_name', 'ticket_number', 'ticket_title', 'ticket_description', 'unit_number', 'assigned_at', 'ticket_link'],
    required: ['ticket_number', 'ticket_title'],
    subject: 'Ticket assigned to you — {{ticket_number}}',
    text: `*New Ticket Assigned – {{ticket_number}}*

${greeting}

A maintenance ticket has been assigned to you.

Ticket: {{ticket_number}}
Issue: {{ticket_title}}
{{#if unit_number}}Unit: {{unit_number}}
{{/if}}{{#if assigned_at}}Assigned On: {{assigned_at}}
{{/if}}{{#if ticket_description}}
{{ticket_description}}
{{/if}}
Please review the ticket and begin work.
{{#if ticket_link}}
Open Ticket: {{ticket_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.TICKET_UPDATED]: {
    variables: ['recipient_name', 'ticket_number', 'ticket_title', 'ticket_description', 'previous_status', 'status', 'update_description', 'updated_at', 'ticket_link'],
    required: ['ticket_number', 'ticket_title', 'status'],
    subject: 'Ticket update — {{ticket_number}}: {{status}}',
    text: `*Ticket Update – {{ticket_number}}*

${greeting}

There has been an update to your maintenance ticket.

Ticket: {{ticket_number}}
Issue: {{ticket_title}}
Current Status: {{status}}
{{#if update_description}}
{{update_description}}
{{/if}}{{#if ticket_link}}
You can view the ticket details and track its progress using the link below.

View Ticket: {{ticket_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.SERVICE_ASSIGNED]: {
    variables: ['recipient_name', 'request_number', 'service_title', 'unit_number', 'scheduled_date', 'request_link'],
    required: ['request_number', 'service_title'],
    subject: 'Service request assigned to you — {{request_number}}',
    text: `*New Service Request Assigned – {{request_number}}*

${greeting}

A service request has been assigned to you.

Request: {{request_number}}
Service: {{service_title}}
{{#if unit_number}}Unit: {{unit_number}}
{{/if}}{{#if scheduled_date}}Scheduled For: {{scheduled_date}}
{{/if}}
Please review the request and confirm the visit.
{{#if request_link}}
Open Request: {{request_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.SERVICE_UPDATED]: {
    variables: ['recipient_name', 'request_number', 'service_title', 'status', 'update_description', 'request_link'],
    required: ['request_number', 'service_title', 'status'],
    subject: 'Service request update — {{request_number}}: {{status}}',
    text: `*Service Request Update – {{request_number}}*

${greeting}

There has been an update to your service request.

Request: {{request_number}}
Service: {{service_title}}
Current Status: {{status}}
{{#if update_description}}
{{update_description}}
{{/if}}{{#if request_link}}
View Request: {{request_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.WORK_ORDER_ASSIGNED]: {
    variables: ['recipient_name', 'work_order_number', 'work_title', 'assigned_at', 'scheduled_date', 'work_order_link'],
    required: ['work_order_number', 'work_title'],
    subject: 'Work order assigned to you — {{work_order_number}}',
    text: `*Work Order Assigned – {{work_order_number}}*

${greeting}

A work order has been assigned to you.

Work Order: {{work_order_number}}
Work: {{work_title}}
{{#if assigned_at}}Assigned On: {{assigned_at}}
{{/if}}{{#if scheduled_date}}Scheduled For: {{scheduled_date}}
{{/if}}{{#if work_order_link}}
View Work Order: {{work_order_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.WORK_ORDER_UPDATED]: {
    variables: ['recipient_name', 'work_order_number', 'work_title', 'status', 'update_description', 'expected_completion', 'work_order_link'],
    required: ['work_order_number', 'work_title', 'status'],
    subject: 'Work order update — {{work_order_number}}: {{status}}',
    text: `*Work Order Update – {{work_order_number}}*

${greeting}

There has been an update to a work order.

Work Order: {{work_order_number}}
Work: {{work_title}}
Current Status: {{status}}
{{#if expected_completion}}Expected Completion: {{expected_completion}}
{{/if}}{{#if update_description}}
{{update_description}}
{{/if}}{{#if work_order_link}}
View Details: {{work_order_link}}
{{/if}}
${signOff}`,
  },

  [NOTIFICATION_TEMPLATES.PASSWORD_RESET]: {
    variables: ['reset_link', 'expires_in'],
    required: ['reset_link'],
    subject: 'Reset your password',
    text: `*Password Reset Request*

We received a request to reset your password.

Reset your password: {{reset_link}}

{{#if expires_in}}This link expires in {{expires_in}}. {{/if}}Do not share this link with anyone. If you did not request a reset, you can ignore this message.`,
  },

  [NOTIFICATION_TEMPLATES.WELCOME]: {
    variables: ['recipient_name', 'username', 'app_link'],
    required: ['app_link'],
    subject: 'Welcome to {{community_name}}',
    text: `*Welcome to {{community_name}}*

${greeting}

Your resident account for {{community_name}} is ready.

{{#if username}}Username: {{username}} (your mobile number)
{{/if}}You will be asked to set a new password the first time you sign in.

Open the app: {{app_link}}

${signOff}`,
  },
};

/**
 * Template a community edits for each configurable event — the main audience's
 * message. Events with no trigger yet keep a template so the editor still works.
 */
export const EVENT_TEMPLATE: Record<string, string> = {
  [NotificationEvent.MAINTENANCE_DUE]: NOTIFICATION_TEMPLATES.MAINTENANCE_DUE,
  [NotificationEvent.PAYMENT_SUCCESS]: NOTIFICATION_TEMPLATES.PAYMENT_SUCCESS,
  [NotificationEvent.PAYMENT_CONFIRMATION]: NOTIFICATION_TEMPLATES.PAYMENT_SUCCESS,
  [NotificationEvent.VISITOR_PASS]: NOTIFICATION_TEMPLATES.VISITOR_PASS,
  [NotificationEvent.VISITOR_APPROVED]: NOTIFICATION_TEMPLATES.VISITOR_APPROVED,
  [NotificationEvent.BOOKING_CONFIRMED]: NOTIFICATION_TEMPLATES.BOOKING_CONFIRMED,
  [NotificationEvent.ANNOUNCEMENT]: NOTIFICATION_TEMPLATES.ANNOUNCEMENT,
  [NotificationEvent.TICKET_CREATED]: NOTIFICATION_TEMPLATES.TICKET_CREATED,
  [NotificationEvent.TICKET_ASSIGNED]: NOTIFICATION_TEMPLATES.TICKET_ASSIGNED,
  [NotificationEvent.TICKET_UPDATE]: NOTIFICATION_TEMPLATES.TICKET_UPDATED,
  [NotificationEvent.SERVICE_ASSIGNED]: NOTIFICATION_TEMPLATES.SERVICE_ASSIGNED,
  [NotificationEvent.SERVICE_UPDATE]: NOTIFICATION_TEMPLATES.SERVICE_UPDATED,
  [NotificationEvent.WORK_ORDER_ASSIGNED]: NOTIFICATION_TEMPLATES.WORK_ORDER_ASSIGNED,
  [NotificationEvent.WORK_ORDER_UPDATE]: NOTIFICATION_TEMPLATES.WORK_ORDER_UPDATED,
  [NotificationEvent.PASSWORD_RESET]: NOTIFICATION_TEMPLATES.PASSWORD_RESET,
  [NotificationEvent.WELCOME]: NOTIFICATION_TEMPLATES.WELCOME,
};

/** Variables a template may reference: its own plus the branding set. */
export function allowedVariables(template: string): VariableName[] {
  return [...(TEMPLATE_SPECS[template]?.variables ?? []), ...BRAND];
}

/** Preview data for a template — every allowed variable filled with its sample. */
export function sampleVariables(template: string): Record<string, string> {
  return Object.fromEntries(allowedVariables(template).map((v) => [v, VARIABLES[v].sample]));
}

/** "IN_PROGRESS" → "In Progress". */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return '';
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * What a ticket status change means for the resident — written per transition
 * so a message never claims more than the event says happened.
 */
export function ticketUpdateDescription(from: string | null | undefined, to: string, note?: string | null): string {
  const reopened = to === 'IN_PROGRESS' && (from === 'RESOLVED' || from === 'CLOSED');
  const lines: Record<string, string> = {
    OPEN: 'Your request is open and waiting to be reviewed by our team.',
    ASSIGNED:
      'Your maintenance request has been assigned to our maintenance team. They will review the issue and proceed with the required action.',
    IN_PROGRESS: reopened
      ? 'Your maintenance request has been reopened and our team is working on it again.'
      : 'Our maintenance team is currently working on your request. You will receive another update once there is further progress.',
    ON_HOLD: 'Work on your request is on hold for now. We will update you as soon as it resumes.',
    RESOLVED:
      'Your maintenance request has been marked as resolved. Please review the resolution and let us know if any further assistance is required.',
    CLOSED: 'Your maintenance request has been closed. Thank you for your patience.',
    CANCELLED: 'Your maintenance request has been cancelled. Please raise a new request if you still need help.',
  };
  const text = lines[to] ?? '';
  const clean = note?.trim();
  return clean ? `${text}${text ? '\n\n' : ''}Note from our team: ${clean}` : text;
}

/** Deep links into the app each audience actually uses. */
export function appLinks(webAppUrl: string) {
  let resident = webAppUrl;
  let workforce = webAppUrl;
  try {
    // Same convention as the portal's Sign-in links card: resident.<host>, workforce.<host>.
    const u = new URL(webAppUrl);
    resident = `${u.protocol}//resident.${u.host}`;
    workforce = `${u.protocol}//workforce.${u.host}`;
  } catch {
    // An unparseable URL leaves every link on the portal origin.
  }
  return { portal: webAppUrl.replace(/\/$/, ''), resident, workforce };
}
