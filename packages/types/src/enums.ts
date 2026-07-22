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
export type ResidentRole = 'PRIMARY' | 'SECONDARY';
export type PersonStatus = 'ACTIVE' | 'INACTIVE';
export type VendorCategory =
  | 'ELECTRICAL' | 'PLUMBING' | 'CIVIL' | 'HOUSEKEEPING' | 'SECURITY'
  | 'GARDENING' | 'PEST_CONTROL' | 'LIFT' | 'DG' | 'STP' | 'HVAC'
  | 'PAINTING' | 'GENERAL';
export type StaffRole =
  | 'FACILITY_MANAGER' | 'SUPERVISOR' | 'SECURITY' | 'HOUSEKEEPING'
  | 'ELECTRICIAN' | 'PLUMBER' | 'TECHNICIAN' | 'ADMIN';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketStatus =
  | 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD'
  | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type TicketSource = 'RESIDENT_APP' | 'ADMIN_PORTAL' | 'INTERNAL';

export type ServiceRequestStatus =
  | 'REQUESTED' | 'ASSIGNED' | 'ACCEPTED' | 'SCHEDULED'
  | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

export type WorkOrderStatus =
  | 'DRAFT' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'ON_HOLD'
  | 'COMPLETED' | 'VERIFIED' | 'CLOSED' | 'CANCELLED';
export type WorkOrderOriginType = 'MANUAL' | 'TICKET' | 'SERVICE_REQUEST';
