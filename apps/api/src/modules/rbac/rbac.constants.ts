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
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every permission, with the resource/action split derived from the key. */
export const PERMISSION_CATALOG: ReadonlyArray<{
  key: PermissionKey;
  resource: string;
  action: string;
  description: string;
}> = Object.values(PERMISSIONS).map((key) => {
  const [resource, action] = key.split(':');
  return {
    key,
    resource: resource!,
    action: action!,
    description: `${action} ${resource}`,
  };
});

// ── System roles ─────────────────────────────────────────────────────────────

export const ROLE_KEYS = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ASSOCIATION_ADMIN: 'ASSOCIATION_ADMIN',
  FACILITY_MANAGER: 'FACILITY_MANAGER',
  RESIDENT: 'RESIDENT',
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
      P.COMMUNITY_CREATE,
      P.COMMUNITY_UPDATE,
      P.COMMUNITY_DELETE,
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
      // Work Order Engine — full control.
      P.WORKORDER_CREATE,
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
      // Work orders — run execution incl. verification and closure.
      P.WORKORDER_CREATE,
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
