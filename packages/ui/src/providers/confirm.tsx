import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Button } from '../components/button';
import { Dialog, DialogContent, DialogFooter } from '../components/dialog';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * Imperative confirmation dialog provider:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete ticket?', tone: 'danger' })) …
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const close = useCallback(
    (value: boolean) => {
      pending?.resolve(value);
      setPending(null);
    },
    [pending],
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog open={!!pending} onOpenChange={(o) => !o && close(false)}>
        <DialogContent
          open={!!pending}
          title={pending?.title}
          description={pending?.description}
        >
          <DialogFooter>
            <Button variant="secondary" onClick={() => close(false)}>
              {pending?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={pending?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => close(true)}
            >
              {pending?.confirmLabel ?? 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a <ConfirmProvider>');
  return ctx;
}
