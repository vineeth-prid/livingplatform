import { type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@living/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

/** Quiet ink label on hover/focus. */
export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 rounded-md bg-inverse px-2.5 py-1.5 text-xs font-medium text-inverse shadow-md',
            'data-[state=delayed-open]:animate-fade-in',
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[var(--surface-inverse)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
