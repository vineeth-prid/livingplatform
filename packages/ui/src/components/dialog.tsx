import { forwardRef, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@living/utils';

import { dialogContent, reduce, scrim } from '../motion';

const MotionOverlay = motion.create(DialogPrimitive.Overlay);
const MotionContent = motion.create(DialogPrimitive.Content);

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Centred modal over a soft blurred scrim, fade + rise. Radix handles focus
 * trapping, escape, and aria; Framer supplies the calm entrance/exit.
 * Controlled `open` is expected so AnimatePresence can play the exit.
 */
export function DialogContent({
  children,
  className,
  open,
  title,
  description,
  showClose = true,
}: {
  children: ReactNode;
  className?: string;
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  showClose?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <MotionOverlay
            variants={reduce(scrim, reduced)}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-50 bg-[var(--surface-scrim)] backdrop-blur-sm"
          />
          <MotionContent
            variants={reduce(dialogContent, reduced)}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2',
              'rounded-xl border border-border-subtle bg-card p-6 shadow-floating',
              'focus:outline-none',
              className,
            )}
          >
            {title && (
              <DialogPrimitive.Title className="font-display text-h3 tracking-tight text-strong">
                {title}
              </DialogPrimitive.Title>
            )}
            {description && (
              <DialogPrimitive.Description className="mt-1.5 text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            )}
            <div className={cn((title || description) && 'mt-5')}>{children}</div>
            {showClose && (
              <DialogPrimitive.Close
                className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:bg-sunken hover:text-strong focus-visible:shadow-ring"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            )}
          </MotionContent>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

export const DialogFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-6 flex justify-end gap-3', className)} {...props} />
  ),
);
DialogFooter.displayName = 'DialogFooter';
