import { PERMISSIONS, ROLE_KEYS, SYSTEM_ROLES } from './rbac.constants';

const permissionsOf = (key: string): string[] => {
  const role = SYSTEM_ROLES.find((r) => r.key === key);
  if (!role) throw new Error(`No system role "${key}"`);
  return role.permissions === '*' ? ['*'] : [...role.permissions];
};

const GATE_PERMISSIONS = [
  PERMISSIONS.GATE_ENTRY_CREATE,
  PERMISSIONS.GATE_ENTRY_VIEW,
  PERMISSIONS.GATE_ENTRY_UPDATE,
  PERMISSIONS.GATE_ENTRY_COMPLETE,
];

const VISITOR_PERMISSIONS = [
  PERMISSIONS.VISITOR_READ,
  PERMISSIONS.VISITOR_CHECKIN,
  PERMISSIONS.VISITOR_CHECKOUT,
];

/**
 * Gate duty is a SEPARATE role from ordinary staff.
 *
 * The gate register carries resident names, unit numbers, phone numbers and
 * what each household is having delivered. An electrician or housekeeper has no
 * business reading it, and before the split every staff account could — these
 * assertions are what stop that regressing the next time someone tidies the
 * role table.
 */
describe('SECURITY role separation', () => {
  it('gives SECURITY the gate permissions', () => {
    const security = permissionsOf(ROLE_KEYS.SECURITY);
    for (const permission of GATE_PERMISSIONS) {
      expect(security).toContain(permission);
    }
  });

  it('gives SECURITY the visitor desk permissions', () => {
    const security = permissionsOf(ROLE_KEYS.SECURITY);
    for (const permission of VISITOR_PERMISSIONS) {
      expect(security).toContain(permission);
    }
  });

  it('keeps every gate permission OFF the ordinary staff role', () => {
    const staff = permissionsOf(ROLE_KEYS.STAFF);
    for (const permission of GATE_PERMISSIONS) {
      expect(staff).not.toContain(permission);
    }
  });

  it('keeps every visitor permission OFF the ordinary staff role', () => {
    const staff = permissionsOf(ROLE_KEYS.STAFF);
    for (const permission of VISITOR_PERMISSIONS) {
      expect(staff).not.toContain(permission);
    }
  });

  /**
   * SECURITY is granted IN ADDITION to STAFF, so it must not duplicate the
   * operational queues — otherwise the two roles drift apart over time and it
   * stops being obvious which one owns what.
   */
  it('does not duplicate the operational queues STAFF already owns', () => {
    const security = permissionsOf(ROLE_KEYS.SECURITY);
    for (const permission of [
      PERMISSIONS.TICKET_UPDATE,
      PERMISSIONS.SERVICE_UPDATE,
      PERMISSIONS.WORKORDER_UPDATE,
    ]) {
      expect(security).not.toContain(permission);
    }
  });

  /**
   * A guard confirming "is this the right flat?" gets unit occupants from a
   * purpose-built gate endpoint that returns name + mobile. Granting
   * `resident:read` instead would hand them the whole resident register.
   */
  it('does not give SECURITY read access to the resident register', () => {
    expect(permissionsOf(ROLE_KEYS.SECURITY)).not.toContain(PERMISSIONS.RESIDENT_READ);
  });

  it('does not give SECURITY analytics or gate administration', () => {
    const security = permissionsOf(ROLE_KEYS.SECURITY);
    expect(security).not.toContain(PERMISSIONS.GATE_ANALYTICS_READ);
    expect(security).not.toContain(PERMISSIONS.GATE_MANAGE);
  });

  /** Approving a visitor stays with the resident, and the FM as an override. */
  it('does not let the gate desk approve visitors on the resident’s behalf', () => {
    expect(permissionsOf(ROLE_KEYS.SECURITY)).not.toContain(PERMISSIONS.VISITOR_APPROVE);
  });

  it('keeps managers able to oversee the gate', () => {
    for (const key of [ROLE_KEYS.ASSOCIATION_ADMIN, ROLE_KEYS.FACILITY_MANAGER]) {
      const permissions = permissionsOf(key);
      expect(permissions).toContain(PERMISSIONS.GATE_ENTRY_VIEW);
      expect(permissions).toContain(PERMISSIONS.GATE_ANALYTICS_READ);
    }
  });

  it('gives vendors no gate access at all', () => {
    const vendor = permissionsOf(ROLE_KEYS.VENDOR);
    for (const permission of [...GATE_PERMISSIONS, ...VISITOR_PERMISSIONS]) {
      expect(vendor).not.toContain(permission);
    }
  });

  /** Residents reach their own entries through self-scoped routes instead. */
  it('gives residents no gate permission', () => {
    const resident = permissionsOf(ROLE_KEYS.RESIDENT);
    for (const permission of GATE_PERMISSIONS) {
      expect(resident).not.toContain(permission);
    }
  });
});
