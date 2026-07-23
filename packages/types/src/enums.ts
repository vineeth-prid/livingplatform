export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type CommunityStatus = 'ONBOARDING' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type CommunityType = 'APARTMENT' | 'VILLA' | 'MIXED' | 'COMMERCIAL';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type HierarchyStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type BlockType =
  | 'TOWER' | 'VILLA_CLUSTER' | 'COMMERCIAL_BLOCK' | 'PLOT' | 'PODIUM' | 'OTHER';
export type UnitStatus = 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'UNDER_MAINTENANCE';
export type OwnershipType = 'OWNER_OCCUPIED' | 'TENANTED' | 'VACANT' | 'UNKNOWN';

export type DocumentCategory =
  | 'ASSOCIATION' | 'RULES' | 'POLICY' | 'EMERGENCY_CONTACT'
  | 'CERTIFICATE' | 'GOVERNMENT_APPROVAL' | 'MINUTES_OF_MEETING' | 'OTHER';
export type DocumentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';
export type ResidentStatus = 'ACTIVE' | 'INACTIVE' | 'MOVED_OUT';
export type ResidentRole = 'PRIMARY' | 'SECONDARY' | 'OWNER' | 'TENANT';
export type PersonStatus = 'ACTIVE' | 'INACTIVE';
// Staff role & vendor category are tenant-managed free strings (CatalogOption),
// no longer fixed enums.
export type VendorCategory = string;
export type StaffRole = string;

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketStatus =
  | 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD'
  | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type TicketSource = 'RESIDENT_APP' | 'ADMIN_PORTAL' | 'INTERNAL';

export type ServiceRequestStatus =
  | 'REQUESTED' | 'ASSIGNED' | 'ACCEPTED' | 'SCHEDULED'
  | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

export type WorkOrderStatus =
  | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  | 'DRAFT' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'ON_HOLD'
  | 'COMPLETED' | 'VERIFIED' | 'CLOSED' | 'CANCELLED';
export type WorkOrderOriginType =
  | 'MANUAL' | 'TICKET' | 'SERVICE_REQUEST' | 'PREVENTIVE_MAINTENANCE' | 'AMC';

// ── Asset Foundation ──
export type AssetStatus =
  | 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE' | 'RETIRED';
export type AssetCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'FAILED';
export type AssetEventType =
  | 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'LOCATION_CHANGED'
  | 'DOCUMENT_ADDED' | 'PHOTO_ADDED' | 'WORK_ORDER_LINKED'
  | 'SERVICE_REQUEST_LINKED' | 'ARCHIVED';

// ── Preventive Maintenance ──
export type MaintenanceFrequency =
  | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';
export type MaintenanceRunStatus = 'SCHEDULED' | 'GENERATED' | 'SKIPPED' | 'FAILED';

// ── AMC Management ──
export type AMCStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWAL_PENDING';
export type CoverageType = 'FULL' | 'PARTIAL' | 'LABOUR_ONLY' | 'PARTS_ONLY' | 'INSPECTION_ONLY';
export type PaymentFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
export type AMCEventType =
  | 'CREATED' | 'UPDATED' | 'ACTIVATED' | 'RENEWED' | 'EXPIRED' | 'TERMINATED'
  | 'ASSET_ADDED' | 'ASSET_REMOVED';

// ── Community Operations ──
export type VisitorStatus = 'PENDING' | 'APPROVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'REJECTED';
export type VisitorType = 'GUEST' | 'DELIVERY' | 'SERVICE' | 'CAB' | 'OTHER';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'EXPIRED';
