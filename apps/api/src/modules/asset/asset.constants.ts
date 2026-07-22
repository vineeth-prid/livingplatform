import { BadRequestException } from '@nestjs/common';

/**
 * System default asset categories, applied per-community at onboarding (asset
 * categories are community-scoped — each community owns its taxonomy). Codes
 * mirror the operational domains used across the platform (tickets, vendors).
 * icon values are Lucide names (the design system's icon set).
 */
export const DEFAULT_ASSET_CATEGORIES: ReadonlyArray<{
  code: string;
  name: string;
  color: string;
  icon: string;
}> = [
  { code: 'ELECTRICAL', name: 'Electrical', color: '#C2941F', icon: 'zap' },
  { code: 'HVAC', name: 'HVAC', color: '#3F6E8C', icon: 'wind' },
  { code: 'CIVIL', name: 'Civil', color: '#6A6255', icon: 'hammer' },
  { code: 'PLUMBING', name: 'Plumbing', color: '#3F6E8C', icon: 'droplet' },
  { code: 'LIFT', name: 'Lift', color: '#325870', icon: 'arrow-up-down' },
  { code: 'FIRE_SAFETY', name: 'Fire Safety', color: '#963A30', icon: 'flame' },
  { code: 'STP', name: 'STP', color: '#2F6347', icon: 'recycle' },
  { code: 'WTP', name: 'WTP', color: '#3E7C5A', icon: 'droplets' },
  { code: 'DG', name: 'DG', color: '#9C5636', icon: 'battery-charging' },
  { code: 'SECURITY', name: 'Security', color: '#963A30', icon: 'shield' },
];

/** Whitelisted sort fields for the asset list (never trust a client column). */
export const ASSET_SORTABLE = [
  'name', 'assetCode', 'categoryId', 'status', 'criticality', 'createdAt', 'warrantyExpiry',
] as const;

/**
 * Validate the lifecycle-date ordering: you cannot install before you buy, and a
 * warranty cannot expire before purchase. Pure — the one piece of asset logic
 * worth a unit test. Only compares dates that are actually provided.
 */
export function assertAssetDatesConsistent(dates: {
  purchaseDate?: Date | null;
  installationDate?: Date | null;
  warrantyExpiry?: Date | null;
}): void {
  const { purchaseDate: p, installationDate: i, warrantyExpiry: w } = dates;
  if (p && i && i < p) {
    throw new BadRequestException('installationDate cannot be before purchaseDate');
  }
  if (p && w && w < p) {
    throw new BadRequestException('warrantyExpiry cannot be before purchaseDate');
  }
}
