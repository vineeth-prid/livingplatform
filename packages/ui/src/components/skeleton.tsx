import { cn } from '@living/utils';

/** Calm shimmer placeholder. Respects reduced motion (animation collapses). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-sunken motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
