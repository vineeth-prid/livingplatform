import { type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@living/utils';

import { drawer, reduce, scrim } from '../motion';

const MotionOverlay = motion.create(DialogPrimitive.Overlay);
const MotionContent = motion.create(DialogPrimitive.Content);

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

type Side = 'left' | 'right' | 'bottom';

const sidePos: Record<Side, string> = {
  left: 'inset-y-0 left-0 h-full w-[min(90vw,420px)] border-r rounded-r-xl',
  right: 'inset-y-0 right-0 h-full w-[min(90vw,420px)] border-l rounded-l-xl',
  bottom: 'inset-x-0 bottom-0 max-h-[85vh] w-full border-t rounded-t-2xl',
};

/** Slide-in panel (drawer). Reuses Radix Dialog for focus trap + a11y. */
export function SheetContent({
  children,
  open,
  side = 'right',
  className,
  title,
  description,
}: {
  children: ReactNode;
  open: boolean;
  side?: Side;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
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
            variants={reduce(drawer(side), reduced)}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              'fixed z-50 flex flex-col border-border-subtle bg-card shadow-floating focus:outline-none',
              sidePos[side],
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 p-6 pb-4">
              <div>
                {title && (
                  <DialogPrimitive.Title className="font-display text-h3 tracking-tight text-strong">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                className="rounded-md p-1 text-muted transition-colors hover:bg-sunken hover:text-strong focus-visible:shadow-ring"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          </MotionContent>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
