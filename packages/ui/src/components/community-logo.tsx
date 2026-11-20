import { useEffect, useState } from 'react';
import { cn } from '@living/utils';

/**
 * A community's own logo, or the default tile (its initial on the brand colour)
 * when it has none — or when the image fails to load, so a broken link never
 * shows as a broken image. The logo keeps its aspect ratio inside the box
 * (object-contain): never stretched, never cropped, transparency preserved.
 */
export function CommunityLogo({
  src,
  name,
  className,
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  // A new community (or a replaced logo) gets a fresh chance to load.
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md', className)}>
        <img
          src={src}
          alt={name ? `${name} logo` : 'Community logo'}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand font-display text-sm text-brand-fg',
        className,
      )}
    >
      {name?.[0]?.toUpperCase() ?? 'L'}
    </span>
  );
}
