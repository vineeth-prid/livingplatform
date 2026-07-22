import { Toaster as SonnerToaster, toast } from 'sonner';

/**
 * Toast provider (sonner) themed to Living tokens. Mount `<ToastProvider />`
 * once near the app root; call `toast.success(...)` etc. anywhere.
 */
export function ToastProvider() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-border-subtle bg-card text-body shadow-floating font-sans',
          title: 'text-strong font-medium',
          description: 'text-muted',
        },
      }}
    />
  );
}

export { toast };
