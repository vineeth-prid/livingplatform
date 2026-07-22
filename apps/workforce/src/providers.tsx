import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@living/design-system';
import { AuthProvider, LivingProvider, createQueryClient } from '@living/hooks';
import { ConfirmProvider, ErrorBoundary, ToastProvider, TooltipProvider } from '@living/ui';

import { living } from './lib/living';
import { persistQueryCache, restoreQueryCache } from './offline';
import { WorkerProvider } from './worker';

const queryClient = createQueryClient();
// Offline data: rehydrate the last snapshot before first paint, then keep it fresh.
restoreQueryCache(queryClient);
persistQueryCache(queryClient);

/** The workforce provider stack — same foundation as the portal and resident apps. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LivingProvider client={living}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <WorkerProvider>
                <TooltipProvider delayDuration={200}>
                  <ConfirmProvider>
                    {children}
                    <ToastProvider />
                  </ConfirmProvider>
                </TooltipProvider>
              </WorkerProvider>
            </AuthProvider>
          </QueryClientProvider>
        </LivingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
