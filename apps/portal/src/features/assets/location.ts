import type { Asset } from '@living/types';

/** A compact human location string from an asset's block/floor/unit + free text. */
export function assetLocation(asset: Pick<Asset, 'block' | 'floor' | 'unit' | 'locationDescription'>): string | null {
  const parts = [
    asset.block?.name,
    asset.floor?.name ?? (asset.floor?.level != null ? `Level ${asset.floor.level}` : undefined),
    asset.unit?.unitNumber ? `Unit ${asset.unit.unitNumber}` : undefined,
    asset.locationDescription,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
