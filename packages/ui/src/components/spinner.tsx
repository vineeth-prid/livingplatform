import { Loader2 } from 'lucide-react';
import { cn } from '@living/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-5 w-5 animate-spin text-muted motion-reduce:animate-none', className)}
      aria-label="Loading"
      role="status"
    />
  );
}
