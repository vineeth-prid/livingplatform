/**
 * System default ticket categories (tenantId = null). Seeded once and available
 * to every tenant; tenants can add their own. The category carries the business
 * context so the engine itself stays generic. iconKey values are Lucide names
 * (the design system's icon set).
 */
export const DEFAULT_TICKET_CATEGORIES: ReadonlyArray<{
  key: string;
  name: string;
  color: string;
  iconKey: string;
}> = [
  { key: 'ELECTRICAL', name: 'Electrical', color: '#C2941F', iconKey: 'zap' },
  { key: 'PLUMBING', name: 'Plumbing', color: '#3F6E8C', iconKey: 'droplet' },
  { key: 'CIVIL', name: 'Civil', color: '#6A6255', iconKey: 'hammer' },
  { key: 'HOUSEKEEPING', name: 'Housekeeping', color: '#3E7C5A', iconKey: 'brush' },
  { key: 'SECURITY', name: 'Security', color: '#963A30', iconKey: 'shield' },
  { key: 'GARDENING', name: 'Gardening', color: '#4E8069', iconKey: 'sprout' },
  { key: 'LIFT', name: 'Lift', color: '#325870', iconKey: 'arrow-up-down' },
  { key: 'DG', name: 'DG', color: '#9C5636', iconKey: 'battery-charging' },
  { key: 'STP', name: 'STP', color: '#2F6347', iconKey: 'recycle' },
  { key: 'HVAC', name: 'HVAC', color: '#3F6E8C', iconKey: 'wind' },
  { key: 'PAINTING', name: 'Painting', color: '#B96A43', iconKey: 'paint-roller' },
  { key: 'CLEANING', name: 'Cleaning', color: '#4E8069', iconKey: 'spray-can' },
  { key: 'GENERAL', name: 'General', color: '#8B8171', iconKey: 'circle-dot' },
];
