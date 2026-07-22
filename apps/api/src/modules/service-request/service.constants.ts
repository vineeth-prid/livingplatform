/**
 * System default services (tenantId = null), seeded once and available to every
 * tenant. Tenants may add their own. iconKey values are Lucide names.
 */
export const DEFAULT_SERVICES: ReadonlyArray<{
  key: string;
  name: string;
  estimatedDurationMinutes: number;
  color: string;
  iconKey: string;
}> = [
  { key: 'ELECTRICIAN', name: 'Electrician', estimatedDurationMinutes: 60, color: '#C2941F', iconKey: 'zap' },
  { key: 'PLUMBER', name: 'Plumber', estimatedDurationMinutes: 60, color: '#3F6E8C', iconKey: 'droplet' },
  { key: 'CARPENTER', name: 'Carpenter', estimatedDurationMinutes: 90, color: '#6A6255', iconKey: 'hammer' },
  { key: 'HOUSEKEEPING', name: 'Housekeeping', estimatedDurationMinutes: 45, color: '#3E7C5A', iconKey: 'brush' },
  { key: 'CLEANING', name: 'Cleaning', estimatedDurationMinutes: 60, color: '#4E8069', iconKey: 'spray-can' },
  { key: 'PAINTING', name: 'Painting', estimatedDurationMinutes: 120, color: '#B96A43', iconKey: 'paint-roller' },
  { key: 'GARDENING', name: 'Gardening', estimatedDurationMinutes: 60, color: '#4E8069', iconKey: 'sprout' },
  { key: 'GENERAL_MAINTENANCE', name: 'General Maintenance', estimatedDurationMinutes: 60, color: '#8B8171', iconKey: 'wrench' },
];
