import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@living/utils';
import { initials as toInitials } from '@living/utils';

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
} as const;

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

/** Image with initials fallback. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-tint',
        sizes[size],
        className,
      )}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          className="h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback className="font-sans font-semibold text-[var(--text-on-tint)]">
        {toInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
