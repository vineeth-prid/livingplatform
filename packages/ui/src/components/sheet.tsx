import { type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@living/utils';

import { dialogContent, drawer, reduce, scrim } from '../motion';

const MotionOverlay = motion.create(DialogPrimitive.Overlay);
const MotionContent = motion.create(DialogPrimitive.Content);

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

type Side = 'left' | 'right' | 'bottom';

const sidePos: Record<'bottom', string> = {
  // `dvh`, not `vh`: on mobile browsers `vh` counts the area behind the URL bar,
  // so 85vh is taller than what the user can actually see and the sheet's
  // buttons end up off-screen.
  //
  // `mx-auto max-w-md` matches the phone frame the resident and workforce apps
  // render inside — a viewport-width sheet visibly overflows that frame on
  // tablet and desktop. Bottom sheets are used only by those two apps.
  bottom: 'inset-x-0 bottom-0 mx-auto w-full max-w-md max-h-[85dvh] border-t rounded-t-2xl',
};

/**
 * Form panel. Reuses Radix Dialog for focus trap, Escape and a11y.
 *
 * `side="bottom"` is the phone apps' bottom sheet. Left/right used to be a
 * 420px edge drawer — too narrow for the admin forms (fields cramped, inline
 * popovers cut off at its edge) — and are now a centred modal: ~80vw up to
 * 1160px, 85dvh tall, with the form's submit row pinned to the bottom
 * (`.living-modal` in the design system's base.css).
 */
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
  const modal = side !== 'bottom';
  const panel = (
    <MotionContent
      variants={reduce(modal ? dialogContent : drawer(side), reduced)}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        'flex flex-col border-border-subtle bg-card shadow-floating focus:outline-none',
        modal
          ? // Centred by the flex wrapper below, never by translate (see overlay-centring.test).
            'living-modal pointer-events-auto relative w-full max-h-[85dvh] rounded-xl border md:w-[80vw] md:max-w-[1160px]'
          : cn('fixed z-50', sidePos.bottom),
        // Old callers sized the edge drawer with a width; the modal sizes itself.
        modal ? className?.replace(/(^|\s)w-\[[^\]]*\]/g, '') : className,
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
            {/* min-h-0 lets this flex child actually shrink so overflow-y-auto
                engages — without it a tall form pushes the sheet past its own
                max height instead of scrolling inside it. The safe-area padding
                keeps the last control clear of the iOS home indicator. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6"
              style={
                side === 'bottom'
                  ? { paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }
                  : undefined
              }
            >
              {children}
            </div>
    </MotionContent>
  );
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
          {modal ? (
            // pointer-events-none lets outside clicks reach the overlay, so Radix still closes.
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
              {panel}
            </div>
          ) : (
            panel
          )}
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
