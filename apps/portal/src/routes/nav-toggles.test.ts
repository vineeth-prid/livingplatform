import { describe, expect, it } from 'vitest';

import { parseCost } from '../features/work-orders/wo-verification';
import { applyModuleToggles, sections } from './dashboard-layout';

const hrefs = (s: ReturnType<typeof applyModuleToggles>) => s.flatMap((x) => x.items.map((i) => i.href));
const on = { maintenanceBilling: true, servicePackages: true, services: true };

describe('portal navigation follows community modules', () => {
  it('shows Services, Packages and Expenses when everything is on', () => {
    const nav = hrefs(applyModuleToggles(sections, on, true));
    expect(nav).toEqual(expect.arrayContaining(['/services', '/packages', '/service-requests', '/expenses']));
  });

  it('Services off hides the catalogue and packages, keeps service-request history', () => {
    const nav = hrefs(applyModuleToggles(sections, { ...on, services: false }, true));
    expect(nav).not.toContain('/services');
    expect(nav).not.toContain('/packages');
    expect(nav).toContain('/service-requests');
    expect(nav).toContain('/work-orders');
  });

  it('Expenses stay when maintenance billing is off, and need expense:read', () => {
    expect(hrefs(applyModuleToggles(sections, { ...on, maintenanceBilling: false }, true))).toContain('/expenses');
    expect(hrefs(applyModuleToggles(sections, on, false))).not.toContain('/expenses');
  });
});

describe('parseCost', () => {
  it('accepts rupees with up to two decimals, blank as no value', () => {
    expect(parseCost('')).toBeUndefined();
    expect(parseCost('2500')).toBe(2500);
    expect(parseCost('99.5')).toBe(99.5);
    expect(parseCost('-1')).toBeNaN();
    expect(parseCost('1.234')).toBeNaN();
  });
});
