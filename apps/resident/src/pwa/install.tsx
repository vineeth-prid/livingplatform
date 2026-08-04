import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Download, MoreVertical, Share, SquarePlus, X } from 'lucide-react';
import { Button, Card, Dialog, DialogContent } from '@living/ui';

import { useInstallPrompt, type InstallPrompt } from './use-install-prompt';

/**
 * "Install Living" — one hook, two surfaces.
 *
 * `InstallBanner` sits above the tab bar and appears once the app is genuinely
 * installable; `InstallButton` lives in Profile so someone who dismissed the
 * banner can still install. Both disappear entirely once installed, and neither
 * renders on a browser that cannot install (no dead-end UI).
 */

export function InstallBanner() {
  const install = useInstallPrompt();
  const reduced = useReducedMotion();
  const [showIosHelp, setShowIosHelp] = useState(false);

  return (
    <>
      <AnimatePresence>
        {install.showBanner && (
          <motion.div
            initial={reduced ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? undefined : { y: 24, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto absolute inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30"
          >
            <Card variant="elevated" className="flex items-center gap-3 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-tint text-brand">
                <Download className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight text-strong">Install Living</p>
                <p className="text-xs leading-tight text-muted">
                  {install.state === 'manual-ios'
                    ? 'Add it to your Home Screen for instant access.'
                    : 'Full screen, works offline, opens instantly.'}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() =>
                  install.state === 'manual-ios' ? setShowIosHelp(true) : void install.install()
                }
              >
                Install
              </Button>
              <button
                type="button"
                aria-label="Dismiss install prompt"
                onClick={install.dismiss}
                className="rounded-full p-1 text-subtle transition-colors hover:text-body focus-visible:outline-none focus-visible:shadow-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <IosInstructions open={showIosHelp} onClose={() => setShowIosHelp(false)} />
    </>
  );
}

/** The explicit control in Profile. Always honest about the current state. */
export function InstallButton({ className }: { className?: string }) {
  const install = useInstallPrompt();
  const [showManualHelp, setShowManualHelp] = useState(false);

  if (install.state === 'installed') {
    return (
      <Card variant="elevated" className={`flex items-center gap-2.5 ${className ?? ''}`}>
        <Check className="h-4 w-4 text-success" />
        <span className="text-sm text-body">Living is installed on this device</span>
      </Card>
    );
  }

  if (install.state === 'unsupported') {
    return (
      <Card variant="elevated" className={`${className ?? ''}`}>
        <p className="text-sm text-body">Install Living</p>
        <p className="mt-1 text-xs text-muted">
          This browser cannot install web apps. Open Living in Chrome, Edge or Safari to add it to
          your home screen.
        </p>
      </Card>
    );
  }

  // 'pending' = Chromium has not fired `beforeinstallprompt` yet (first visit,
  // or the engagement heuristic has not tripped). Android users hit this most
  // often, and a disabled button is a dead end — so the button stays live and
  // falls back to the browser's own menu steps, which always work.
  const manual = install.state === 'manual-ios' || install.state === 'pending';

  return (
    <>
      <Button
        variant="secondary"
        block
        size="lg"
        className={className}
        onClick={() => (manual ? setShowManualHelp(true) : void install.install())}
      >
        <Download className="h-4 w-4" />
        Add to Home Screen
      </Button>
      {install.state === 'manual-ios' ? (
        <IosInstructions open={showManualHelp} onClose={() => setShowManualHelp(false)} />
      ) : (
        <AndroidInstructions open={showManualHelp} onClose={() => setShowManualHelp(false)} />
      )}
    </>
  );
}

/** Chromium before `beforeinstallprompt` fires — the browser menu still works. */
function AndroidInstructions({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent open={open} title="Add Living to your Home Screen" className="max-w-md">
        <ol className="space-y-3 text-sm text-body">
          <li className="flex items-start gap-3">
            <MoreVertical className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <span>
              Tap the <strong>menu</strong> (⋮) in your browser&apos;s toolbar.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <SquarePlus className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <span>
              Choose <strong>Add to Home screen</strong> (or <strong>Install app</strong>).
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <span>
              Confirm. Living opens full screen from your home screen.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-xs text-subtle">
          Living can also offer a one-tap install once you have used it a couple of times — this
          menu route always works in the meantime.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** iOS has no install API — the only honest thing to do is show the steps. */
function IosInstructions({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent open={open} title="Add Living to your Home Screen" className="max-w-md">
        <ol className="space-y-3 text-sm text-body">
          <li className="flex items-start gap-3">
            <Share className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <span>
              Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <SquarePlus className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <span>
              Scroll down and choose <strong>Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <span>
              Tap <strong>Add</strong>. Living opens full screen from your home screen.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-xs text-subtle">
          Safari only — Chrome and Firefox on iOS cannot add apps to the home screen.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export type { InstallPrompt };
