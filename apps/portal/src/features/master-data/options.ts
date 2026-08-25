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
// STAFF_ROLE and VENDOR_CATEGORY are NOT listed here. They are tenant catalogs
// (see `useCatalogOptions`) — an admin adds and removes their own options, so a
// copy of the seed defaults here could only ever be a second, wrong answer.
