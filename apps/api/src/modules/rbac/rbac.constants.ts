/**
 * Canonical RBAC catalog for the platform foundation.
 *
 * Permissions and roles are stored in the database (configurable, not
 * hardcoded into guards). This file is the *seed source of truth* and the
 * typed reference used by decorators so permission strings stay checkable at
 * compile time. Adding a permission here + reseeding is a data change, not a
 * schema change — new communities/tenants need no code to onboard.
 *
 * Sprint 1 covers ONLY foundation resources (tenant, community, user, role,
 * permission, audit). Business resources (tickets, vendors, assets, …) are
 * intentionally absent and get added the same way when their modules land.
 */

import { RoleScope } from '@prisma/client';

// ── Permission catalog ───────────────────────────────────────────────────────

/** A permission key is always `resource:action`. */
export const PERMISSIONS = {
  // Tenant administration (platform-level)
  TENANT_READ: 'tenant:read',
  TENANT_CREATE: 'tenant:create',
  TENANT_UPDATE: 'tenant:update',
  TENANT_DELETE: 'tenant:delete',

  // Community administration
  COMMUNITY_READ: 'community:read',
  COMMUNITY_CREATE: 'community:create',
  COMMUNITY_UPDATE: 'community:update',
  COMMUNITY_DELETE: 'community:delete',

  // User administration
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // Role & permission administration
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',
  PERMISSION_READ: 'permission:read',

  // Audit
  AUDIT_READ: 'audit:read',

  // ── Sprint 2 — Community Foundation ──
  // Property hierarchy (phases, blocks/towers, floors)
  HIERARCHY_READ: 'hierarchy:read',
  HIERARCHY_CREATE: 'hierarchy:create',
  HIERARCHY_UPDATE: 'hierarchy:update',
  HIERARCHY_DELETE: 'hierarchy:delete',

  // Units
  UNIT_READ: 'unit:read',
  UNIT_CREATE: 'unit:create',
  UNIT_UPDATE: 'unit:update',
  UNIT_DELETE: 'unit:delete',

  // Amenities
  AMENITY_READ: 'amenity:read',
  AMENITY_CREATE: 'amenity:create',
  AMENITY_UPDATE: 'amenity:update',
  AMENITY_DELETE: 'amenity:delete',

  // Community documents (metadata)
  DOCUMENT_READ: 'document:read',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',

  // Community settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  // ── Sprint 3 — People Foundation ──
  // Residents (+ assign = map a resident to a unit)
  RESIDENT_READ: 'resident:read',
  RESIDENT_CREATE: 'resident:create',
  RESIDENT_UPDATE: 'resident:update',
  RESIDENT_DELETE: 'resident:delete',
  RESIDENT_ASSIGN: 'resident:assign',

  // Vendors
  VENDOR_READ: 'vendor:read',
  VENDOR_CREATE: 'vendor:create',
  VENDOR_UPDATE: 'vendor:update',
  VENDOR_DELETE: 'vendor:delete',

  // Staff
  STAFF_READ: 'staff:read',
  STAFF_CREATE: 'staff:create',
  STAFF_UPDATE: 'staff:update',
  STAFF_DELETE: 'staff:delete',

  // ── Sprint 4 — Ticket Engine ──
  TICKET_CREATE: 'ticket:create',
  TICKET_VIEW: 'ticket:view',
  TICKET_UPDATE: 'ticket:update',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_COMMENT: 'ticket:comment',
  TICKET_RESOLVE: 'ticket:resolve',
  TICKET_CLOSE: 'ticket:close',
  TICKET_DELETE: 'ticket:delete',

  // ── Sprint 5 — Service Request Engine ──
  SERVICE_CREATE: 'service:create',
  SERVICE_VIEW: 'service:view',
  SERVICE_UPDATE: 'service:update',
  SERVICE_ASSIGN: 'service:assign',
  SERVICE_COMPLETE: 'service:complete',
  SERVICE_CANCEL: 'service:cancel',

  // ── Sprint 6 — Work Order Engine ──
  WORKORDER_CREATE: 'workorder:create',
  WORKORDER_RECOMMEND: 'workorder:recommend',
  WORKORDER_APPROVE: 'workorder:approve',
  WORKORDER_VIEW: 'workorder:view',
  WORKORDER_UPDATE: 'workorder:update',
  WORKORDER_ASSIGN: 'workorder:assign',
  WORKORDER_START: 'workorder:start',
  WORKORDER_COMPLETE: 'workorder:complete',
  WORKORDER_VERIFY: 'workorder:verify',
  WORKORDER_CLOSE: 'workorder:close',

  // ── Sprint 7 — Asset Foundation ──
  ASSET_READ: 'asset:read',
  ASSET_CREATE: 'asset:create',
  ASSET_UPDATE: 'asset:update',
  ASSET_DELETE: 'asset:delete',
  ASSET_CATEGORY_MANAGE: 'asset:category:manage',
  ASSET_DOCUMENT_CREATE: 'asset:document:create',
  ASSET_PHOTO_CREATE: 'asset:photo:create',

  // ── Sprint 8 — Preventive Maintenance Engine ──
  MAINTENANCE_READ: 'maintenance:read',
  MAINTENANCE_CREATE: 'maintenance:create',
  MAINTENANCE_UPDATE: 'maintenance:update',
  MAINTENANCE_DELETE: 'maintenance:delete',
  MAINTENANCE_GENERATE: 'maintenance:generate',
  MAINTENANCE_CHECKLIST_MANAGE: 'maintenance:checklist:manage',

  // ── Sprint 9 — AMC Management Engine ──
  AMC_READ: 'amc:read',
  AMC_CREATE: 'amc:create',
  AMC_UPDATE: 'amc:update',
  AMC_DELETE: 'amc:delete',
  AMC_RENEW: 'amc:renew',
  AMC_COVERAGE_MANAGE: 'amc:coverage:manage',
  AMC_SLA_MANAGE: 'amc:sla:manage',

  // ── Sprint 10 — Community Operations ──
  // (amenity:* and document:* already exist from Sprint 2 and are reused.)
  VISITOR_READ: 'visitor:read',
  VISITOR_CREATE: 'visitor:create',
  VISITOR_UPDATE: 'visitor:update',
  VISITOR_APPROVE: 'visitor:approve',
  VISITOR_CHECKIN: 'visitor:checkin',
  VISITOR_CHECKOUT: 'visitor:checkout',

  BOOKING_READ: 'booking:read',
  BOOKING_CREATE: 'booking:create',
  BOOKING_UPDATE: 'booking:update',
  BOOKING_CANCEL: 'booking:cancel',

  ANNOUNCEMENT_READ: 'announcement:read',
  ANNOUNCEMENT_CREATE: 'announcement:create',
  ANNOUNCEMENT_UPDATE: 'announcement:update',
  ANNOUNCEMENT_PUBLISH: 'announcement:publish',

  // ── Sprint 11 — Payments & Maintenance Billing ──
  // Community gateway configuration. `payment:config:read` returns STATUS only;
  // secrets are never in a response body regardless of permission.
  PAYMENT_CONFIG_READ: 'payment:config:read',
  PAYMENT_CONFIG_UPDATE: 'payment:config:update',

  // Maintenance rate cards (charge configuration by property type).
  BILLING_CHARGE_READ: 'billing:charge:read',
  BILLING_CHARGE_MANAGE: 'billing:charge:manage',

  // Invoices & collection.
  BILLING_INVOICE_READ: 'billing:invoice:read',
  BILLING_INVOICE_GENERATE: 'billing:invoice:generate',
  BILLING_INVOICE_UPDATE: 'billing:invoice:update',
  BILLING_DASHBOARD_READ: 'billing:dashboard:read',

  // Payments (transaction history + initiating a checkout).
  PAYMENT_READ: 'payment:read',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_REFUND: 'payment:refund',

  // Notification routing & templates, per community.
  NOTIFICATION_PREFERENCE_READ: 'notification:preference:read',
  NOTIFICATION_PREFERENCE_UPDATE: 'notification:preference:update',
  NOTIFICATION_TEMPLATE_READ: 'notification:template:read',
  NOTIFICATION_TEMPLATE_MANAGE: 'notification:template:manage',

  // Platform-level WhatsApp gateway administration (Platform Admin only).
  WHATSAPP_ADMIN: 'whatsapp:admin',

  // ── Sprint 12 — Service catalog, Packages & Insights ──
  // The catalog itself (enable/disable a service for the community).
  SERVICE_CATALOG_READ: 'service:catalog:read',
  SERVICE_CATALOG_MANAGE: 'service:catalog:manage',

  // Service Packages — bundles built on the catalog.
  PACKAGE_READ: 'package:read',
  PACKAGE_MANAGE: 'package:manage',
  PACKAGE_PURCHASE: 'package:purchase',

  // Business intelligence for a community (adoption, revenue, top vendors).
  INSIGHTS_READ: 'insights:read',

  // ── Sprint 13 — Gate Management ──
  // Recording an arrival at the gate (security staff).
  GATE_ENTRY_CREATE: 'gate:entry:create',
  // Reading the gate register. Residents do NOT need this: their own entries
  // are served by a self-scoped route, exactly like /residents/me.
  GATE_ENTRY_VIEW: 'gate:entry:view',
  // Correcting or cancelling an entry after the fact.
  GATE_ENTRY_UPDATE: 'gate:entry:update',
  // Marking an approved arrival as handed over / completed at the gate.
  GATE_ENTRY_COMPLETE: 'gate:entry:complete',
  // Register-wide analytics and reporting.
  GATE_ANALYTICS_READ: 'gate:analytics:read',
  // Managing the community's named gates.
  GATE_MANAGE: 'gate:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every permission, with the resource/action split derived from the key. */
export const PERMISSION_CATALOG: ReadonlyArray<{
  key: PermissionKey;
  resource: string;
  action: string;
  description: string;
}> = Object.values(PERMISSIONS).map((key) => {
  // `resource:action` for most keys; namespaced keys ("billing:invoice:read")
  // keep the first segment as the resource and the remainder as the action.
  const [resource, ...rest] = key.split(':');
  const action = rest.join(':');
  return {
    key,
    resource: resource!,
    action,
    description: `${action.replace(/:/g, ' ')} ${resource}`,
  };
});

// ── System roles ─────────────────────────────────────────────────────────────

export const ROLE_KEYS = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ASSOCIATION_ADMIN: 'ASSOCIATION_ADMIN',
  FACILITY_MANAGER: 'FACILITY_MANAGER',
  RESIDENT: 'RESIDENT',
  STAFF: 'STAFF',
  /**
   * Gate duty. Granted IN ADDITION to STAFF — a guard is still a staff member
   * with tickets and work orders, they just also man the gate. Keeping it
   * additive means ordinary staff need no exclusion logic: they simply never
   * receive this role.
   */
  SECURITY: 'SECURITY',
  VENDOR: 'VENDOR',
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

const P = PERMISSIONS;

/**
 * System role definitions. `permissions: '*'` means "all permissions" and is
 * expanded at seed time — it also lets the Platform Admin implicitly hold any
 * permission added later without reseeding role grants.
 */
export const SYSTEM_ROLES: ReadonlyArray<{
  key: RoleKey;
  name: string;
  description: string;
  scope: RoleScope;
  permissions: PermissionKey[] | '*';
}> = [
  {
    key: ROLE_KEYS.PLATFORM_ADMIN,
    name: 'Platform Admin',
    description: 'Full control across every tenant and community.',
    scope: RoleScope.PLATFORM,
    permissions: '*',
  },
  {
    key: ROLE_KEYS.ASSOCIATION_ADMIN,
    name: 'Association Admin',
    description: 'Administers all communities, users and roles within a tenant.',
    scope: RoleScope.TENANT,
    permissions: [
      P.TENANT_READ,
      P.TENANT_UPDATE,
      P.COMMUNITY_READ,
      // Community create/delete is Platform-Admin only — associations operate
      // *within* their provisioned community, they don't create/remove them.
      P.COMMUNITY_UPDATE,
      P.USER_READ,
      P.USER_CREATE,
      P.USER_UPDATE,
      P.USER_DELETE,
      P.ROLE_READ,
      P.ROLE_ASSIGN,
      P.PERMISSION_READ,
      P.AUDIT_READ,
      // Community Foundation — full control within the tenant.
      P.HIERARCHY_READ,
      P.HIERARCHY_CREATE,
      P.HIERARCHY_UPDATE,
      P.HIERARCHY_DELETE,
      P.UNIT_READ,
      P.UNIT_CREATE,
      P.UNIT_UPDATE,
      P.UNIT_DELETE,
      P.AMENITY_READ,
      P.AMENITY_CREATE,
      P.AMENITY_UPDATE,
      P.AMENITY_DELETE,
      P.DOCUMENT_READ,
      P.DOCUMENT_CREATE,
      P.DOCUMENT_UPDATE,
      P.DOCUMENT_DELETE,
      P.SETTINGS_READ,
      P.SETTINGS_UPDATE,
      // People Foundation — full control within the tenant.
      P.RESIDENT_READ,
      P.RESIDENT_CREATE,
      P.RESIDENT_UPDATE,
      P.RESIDENT_DELETE,
      P.RESIDENT_ASSIGN,
      P.VENDOR_READ,
      P.VENDOR_CREATE,
      P.VENDOR_UPDATE,
      P.VENDOR_DELETE,
      P.STAFF_READ,
      P.STAFF_CREATE,
      P.STAFF_UPDATE,
      P.STAFF_DELETE,
      // Ticket Engine — full control.
      P.TICKET_CREATE,
      P.TICKET_VIEW,
      P.TICKET_UPDATE,
      P.TICKET_ASSIGN,
      P.TICKET_COMMENT,
      P.TICKET_RESOLVE,
      P.TICKET_CLOSE,
      P.TICKET_DELETE,
      // Service Request Engine — full control.
      P.SERVICE_CREATE,
      P.SERVICE_VIEW,
      P.SERVICE_UPDATE,
      P.SERVICE_ASSIGN,
      P.SERVICE_COMPLETE,
      P.SERVICE_CANCEL,
      // Work Order Engine — full control (incl. recommend + approve).
      P.WORKORDER_CREATE,
      P.WORKORDER_RECOMMEND,
      P.WORKORDER_APPROVE,
      P.WORKORDER_VIEW,
      P.WORKORDER_UPDATE,
      P.WORKORDER_ASSIGN,
      P.WORKORDER_START,
      P.WORKORDER_COMPLETE,
      P.WORKORDER_VERIFY,
      P.WORKORDER_CLOSE,
      // Asset Foundation — full control.
      P.ASSET_READ,
      P.ASSET_CREATE,
      P.ASSET_UPDATE,
      P.ASSET_DELETE,
      P.ASSET_CATEGORY_MANAGE,
      P.ASSET_DOCUMENT_CREATE,
      P.ASSET_PHOTO_CREATE,
      // Preventive Maintenance — full control.
      P.MAINTENANCE_READ,
      P.MAINTENANCE_CREATE,
      P.MAINTENANCE_UPDATE,
      P.MAINTENANCE_DELETE,
      P.MAINTENANCE_GENERATE,
      P.MAINTENANCE_CHECKLIST_MANAGE,
      // AMC Management — full control.
      P.AMC_READ,
      P.AMC_CREATE,
      P.AMC_UPDATE,
      P.AMC_DELETE,
      P.AMC_RENEW,
      P.AMC_COVERAGE_MANAGE,
      P.AMC_SLA_MANAGE,
      // Community Operations — full control.
      P.VISITOR_READ,
      P.VISITOR_CREATE,
      P.VISITOR_UPDATE,
      P.VISITOR_APPROVE,
      P.VISITOR_CHECKIN,
      P.VISITOR_CHECKOUT,
      P.BOOKING_READ,
      P.BOOKING_CREATE,
      P.BOOKING_UPDATE,
      P.BOOKING_CANCEL,
      P.ANNOUNCEMENT_READ,
      P.ANNOUNCEMENT_CREATE,
      P.ANNOUNCEMENT_UPDATE,
      P.ANNOUNCEMENT_PUBLISH,
      // Payments & Billing — the association owns the money rails end to end.
      P.PAYMENT_CONFIG_READ,
      P.PAYMENT_CONFIG_UPDATE,
      P.BILLING_CHARGE_READ,
      P.BILLING_CHARGE_MANAGE,
      P.BILLING_INVOICE_READ,
      P.BILLING_INVOICE_GENERATE,
      P.BILLING_INVOICE_UPDATE,
      P.BILLING_DASHBOARD_READ,
      P.PAYMENT_READ,
      P.PAYMENT_CREATE,
      P.PAYMENT_REFUND,
      // Notification routing & message templates for its communities.
      P.NOTIFICATION_PREFERENCE_READ,
      P.NOTIFICATION_PREFERENCE_UPDATE,
      P.NOTIFICATION_TEMPLATE_READ,
      P.NOTIFICATION_TEMPLATE_MANAGE,
      // Service catalog, packages and business intelligence.
      P.SERVICE_CATALOG_READ,
      P.SERVICE_CATALOG_MANAGE,
      P.PACKAGE_READ,
      P.PACKAGE_MANAGE,
      P.INSIGHTS_READ,
      // Gate Management — full oversight of the register and its reporting.
      P.GATE_ENTRY_CREATE,
      P.GATE_ENTRY_VIEW,
      P.GATE_ENTRY_UPDATE,
      P.GATE_ENTRY_COMPLETE,
      P.GATE_ANALYTICS_READ,
      P.GATE_MANAGE,
    ],
  },
  {
    key: ROLE_KEYS.FACILITY_MANAGER,
    name: 'Facility Manager',
    description: 'Operates a single community.',
    scope: RoleScope.COMMUNITY,
    permissions: [
      P.COMMUNITY_READ,
      P.COMMUNITY_UPDATE,
      P.USER_READ,
      P.HIERARCHY_READ,
      P.HIERARCHY_UPDATE,
      P.UNIT_READ,
      P.UNIT_UPDATE,
      P.AMENITY_READ,
      P.AMENITY_UPDATE,
      P.DOCUMENT_READ,
      P.DOCUMENT_CREATE,
      P.SETTINGS_READ,
      // People — a Facility Manager runs day-to-day operations.
      P.RESIDENT_READ,
      P.RESIDENT_CREATE,
      P.RESIDENT_UPDATE,
      P.RESIDENT_ASSIGN,
      P.VENDOR_READ,
      P.STAFF_READ,
      P.STAFF_CREATE,
      P.STAFF_UPDATE,
      // Tickets — operate the queue (no delete).
      P.TICKET_CREATE,
      P.TICKET_VIEW,
      P.TICKET_UPDATE,
      P.TICKET_ASSIGN,
      P.TICKET_COMMENT,
      P.TICKET_RESOLVE,
      P.TICKET_CLOSE,
      // Service requests — dispatch and fulfil.
      P.SERVICE_CREATE,
      P.SERVICE_VIEW,
      P.SERVICE_UPDATE,
      P.SERVICE_ASSIGN,
      P.SERVICE_COMPLETE,
      P.SERVICE_CANCEL,
      // Work orders — run execution incl. recommend/approve, verification, closure.
      P.WORKORDER_CREATE,
      P.WORKORDER_RECOMMEND,
      P.WORKORDER_APPROVE,
      P.WORKORDER_VIEW,
      P.WORKORDER_UPDATE,
      P.WORKORDER_ASSIGN,
      P.WORKORDER_START,
      P.WORKORDER_COMPLETE,
      P.WORKORDER_VERIFY,
      P.WORKORDER_CLOSE,
      // Assets — the FM owns the asset register day-to-day (no hard delete).
      P.ASSET_READ,
      P.ASSET_CREATE,
      P.ASSET_UPDATE,
      P.ASSET_CATEGORY_MANAGE,
      P.ASSET_DOCUMENT_CREATE,
      P.ASSET_PHOTO_CREATE,
      // Preventive Maintenance — the FM owns the maintenance calendar (no delete).
      P.MAINTENANCE_READ,
      P.MAINTENANCE_CREATE,
      P.MAINTENANCE_UPDATE,
      P.MAINTENANCE_GENERATE,
      P.MAINTENANCE_CHECKLIST_MANAGE,
      // AMC — the FM manages contracts day-to-day (no hard delete).
      P.AMC_READ,
      P.AMC_CREATE,
      P.AMC_UPDATE,
      P.AMC_RENEW,
      P.AMC_COVERAGE_MANAGE,
      P.AMC_SLA_MANAGE,
      // Community Operations — the FM runs the front desk & notices.
      P.VISITOR_READ,
      P.VISITOR_CREATE,
      P.VISITOR_UPDATE,
      P.VISITOR_APPROVE,
      P.VISITOR_CHECKIN,
      P.VISITOR_CHECKOUT,
      P.BOOKING_READ,
      P.BOOKING_UPDATE,
      P.BOOKING_CANCEL,
      P.ANNOUNCEMENT_READ,
      P.ANNOUNCEMENT_CREATE,
      P.ANNOUNCEMENT_UPDATE,
      P.ANNOUNCEMENT_PUBLISH,
      // Billing — the FM runs collection day to day but never touches gateway
      // credentials (that stays with the Association Admin).
      P.BILLING_CHARGE_READ,
      P.BILLING_INVOICE_READ,
      P.BILLING_INVOICE_GENERATE,
      P.BILLING_INVOICE_UPDATE,
      P.BILLING_DASHBOARD_READ,
      P.PAYMENT_READ,
      P.NOTIFICATION_PREFERENCE_READ,
      P.NOTIFICATION_TEMPLATE_READ,
      // The FM curates what residents can book, and reads the numbers.
      P.SERVICE_CATALOG_READ,
      P.SERVICE_CATALOG_MANAGE,
      P.PACKAGE_READ,
      P.PACKAGE_MANAGE,
      P.INSIGHTS_READ,
      // Gate Management — the FM runs the desk and names the gates.
      P.GATE_ENTRY_CREATE,
      P.GATE_ENTRY_VIEW,
      P.GATE_ENTRY_UPDATE,
      P.GATE_ENTRY_COMPLETE,
      P.GATE_ANALYTICS_READ,
      P.GATE_MANAGE,
    ],
  },
  {
    key: ROLE_KEYS.RESIDENT,
    name: 'Resident',
    description: 'A resident member of a community.',
    scope: RoleScope.COMMUNITY,
    permissions: [
      P.COMMUNITY_READ,
      P.HIERARCHY_READ,
      P.UNIT_READ,
      P.AMENITY_READ,
      P.DOCUMENT_READ,
      // Residents raise tickets, follow them, and comment.
      P.TICKET_CREATE,
      P.TICKET_VIEW,
      P.TICKET_COMMENT,
      // Residents request services and give feedback.
      P.SERVICE_CREATE,
      P.SERVICE_VIEW,
      // Community life — invite visitors, book amenities, read notices.
      P.VISITOR_READ,
      P.VISITOR_CREATE,
      P.VISITOR_UPDATE,
      P.BOOKING_READ,
      P.BOOKING_CREATE,
      P.BOOKING_CANCEL,
      P.ANNOUNCEMENT_READ,
      // Maintenance billing — a resident sees and pays only their own dues
      // (scoped in BillingService/PaymentService, not by the permission alone).
      P.BILLING_INVOICE_READ,
      P.PAYMENT_READ,
      P.PAYMENT_CREATE,
      // Residents browse packages and buy them; they never manage the catalog.
      P.SERVICE_CATALOG_READ,
      P.PACKAGE_READ,
      P.PACKAGE_PURCHASE,
    ],
  },
  {
    key: ROLE_KEYS.STAFF,
    name: 'Staff',
    description: 'A community staff member working the operational queues.',
    scope: RoleScope.COMMUNITY,
    permissions: [
      P.COMMUNITY_READ,
      P.HIERARCHY_READ,
      P.UNIT_READ,
      P.AMENITY_READ,
      // Staff work their assigned tickets and service requests.
      P.TICKET_VIEW,
      P.TICKET_UPDATE,
      P.TICKET_COMMENT,
      P.TICKET_RESOLVE,
      P.SERVICE_VIEW,
      P.SERVICE_UPDATE,
      P.SERVICE_COMPLETE,
      // Staff execute work orders (not verify/close) and may RAISE one.
      //
      // CREATE + RECOMMEND together, deliberately: a staff member who finds a
      // burst pipe must be able to raise the work, but it lands in the approval
      // queue rather than going live on their say-so. Approval itself stays with
      // whoever holds WORKORDER_APPROVE (Association Admin / Facility Manager).
      P.WORKORDER_CREATE,
      P.WORKORDER_RECOMMEND,
      P.WORKORDER_VIEW,
      P.WORKORDER_UPDATE,
      P.WORKORDER_START,
      P.WORKORDER_COMPLETE,
      P.ASSET_READ,
      P.ANNOUNCEMENT_READ,
      // NOTE: gate and visitor permissions deliberately live on the SECURITY
      // role, not here. A plumber or housekeeper has no business seeing who is
      // delivering what to which flat, and the gate register carries resident
      // names, unit numbers and phone numbers.
    ],
  },
  {
    key: ROLE_KEYS.SECURITY,
    name: 'Security',
    description: 'Mans the gate — records arrivals, and runs the visitor register.',
    scope: RoleScope.COMMUNITY,
    permissions: [
      // Enough context to do gate duty and nothing more. Notably absent:
      // RESIDENT_READ — a guard must not be able to page through the resident
      // register. The unit occupants they legitimately need are served by a
      // purpose-built gate endpoint that returns name + mobile only.
      P.COMMUNITY_READ,
      P.HIERARCHY_READ,
      P.UNIT_READ,
      P.ANNOUNCEMENT_READ,
      // Gate Management — record an arrival, correct a mistake, hand it over.
      // No analytics and no gate administration: that is a manager's job.
      P.GATE_ENTRY_CREATE,
      P.GATE_ENTRY_VIEW,
      P.GATE_ENTRY_UPDATE,
      P.GATE_ENTRY_COMPLETE,
      // Visitors — the gate desk checks people in and out. Approval stays with
      // the resident (and the Facility Manager as an override), unchanged.
      P.VISITOR_READ,
      P.VISITOR_CHECKIN,
      P.VISITOR_CHECKOUT,
    ],
  },
  {
    key: ROLE_KEYS.VENDOR,
    name: 'Vendor',
    description: 'An external vendor operating within a community.',
    scope: RoleScope.COMMUNITY,
    permissions: [
      P.COMMUNITY_READ,
      P.AMENITY_READ,
      // Vendors work their assigned tickets.
      P.TICKET_VIEW,
      P.TICKET_UPDATE,
      P.TICKET_COMMENT,
      P.TICKET_RESOLVE,
      // Vendors fulfil their assigned service requests.
      P.SERVICE_VIEW,
      P.SERVICE_UPDATE,
      P.SERVICE_COMPLETE,
      // Vendors execute their assigned work orders (not verify/close).
      P.WORKORDER_VIEW,
      P.WORKORDER_UPDATE,
      P.WORKORDER_START,
      P.WORKORDER_COMPLETE,
      // Vendors can see the assets they service (read-only).
      P.ASSET_READ,
    ],
  },
];
