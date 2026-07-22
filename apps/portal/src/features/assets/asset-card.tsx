import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Package } from 'lucide-react';
import type { Asset } from '@living/types';
import { cn } from '@living/utils';

import { AssetStatusBadge, WarrantyIndicator } from './asset-badges';
import { assetLocation } from './location';

/** A premium asset card for the register's card view. */
export function AssetCard({ asset }: { asset: Asset }) {
  const reduced = useReducedMotion();
  const location = assetLocation(asset);
  return (
    <Link to={`/assets/${asset.id}` as string} className="focus-visible:outline-none focus-visible:shadow-ring rounded-card">
      <motion.div
        whileHover={reduced ? undefined : { y: -2 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className={cn('flex h-full flex-col gap-3 rounded-card border border-border-subtle bg-card p-4 shadow-sm transition-shadow hover:shadow-md')}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand" style={assetTint(asset)}>
            <Package className="h-5 w-5" />
          </span>
          <AssetStatusBadge status={asset.status} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-strong">{asset.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            <span className="font-mono">{asset.assetCode}</span>
            {asset.category?.name && <> · {asset.category.name}</>}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="truncate text-xs text-subtle">{location ?? 'No location'}</span>
          <WarrantyIndicator expiry={asset.warrantyExpiry} showLabel={false} />
        </div>
      </motion.div>
    </Link>
  );
}

/** Tint the icon with the category colour when available. */
function assetTint(asset: Asset): React.CSSProperties | undefined {
  const color = asset.category?.color;
  return color ? { backgroundColor: `${color}1a`, color } : undefined;
}
