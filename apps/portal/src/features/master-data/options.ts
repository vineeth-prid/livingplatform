/** Enum → select-option helpers shared by lists (filters) and forms. */

const humanize = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ');

export const opt = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: humanize(v) }));

export const RESIDENT_STATUS = ['ACTIVE', 'INACTIVE', 'MOVED_OUT'] as const;
export const PERSON_STATUS = ['ACTIVE', 'INACTIVE'] as const;
export const GENDER = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] as const;
export const UNIT_STATUS = ['VACANT', 'OCCUPIED', 'RESERVED', 'UNDER_MAINTENANCE'] as const;
export const HIERARCHY_STATUS = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;
export const BLOCK_TYPE = [
  'TOWER', 'VILLA_CLUSTER', 'COMMERCIAL_BLOCK', 'PLOT', 'PODIUM', 'OTHER',
] as const;
export const OWNERSHIP = ['OWNER_OCCUPIED', 'TENANTED', 'VACANT', 'UNKNOWN'] as const;
export const VENDOR_CATEGORY = [
  'ELECTRICAL', 'PLUMBING', 'CIVIL', 'HOUSEKEEPING', 'SECURITY', 'GARDENING',
  'PEST_CONTROL', 'LIFT', 'DG', 'STP', 'HVAC', 'PAINTING', 'GENERAL',
] as const;
export const STAFF_ROLE = [
  'FACILITY_MANAGER', 'SUPERVISOR', 'SECURITY', 'HOUSEKEEPING',
  'ELECTRICIAN', 'PLUMBER', 'TECHNICIAN', 'ADMIN',
] as const;
