import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@living/design-system';
import { AuthProvider, LivingProvider, createQueryClient } from '@living/hooks';
import { ConfirmProvider, ErrorBoundary, ToastProvider, TooltipProvider } from '@living/ui';

import { CommunityProvider } from './community';
import { living } from './lib/living';

const queryClient = createQueryClient();

/** The resident provider stack — same foundation as the portal. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LivingProvider client={living}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <CommunityProvider>
                <TooltipProvider delayDuration={200}>
                  <ConfirmProvider>
                    {children}
                    <ToastProvider />
                  </ConfirmProvider>
                </TooltipProvider>
              </CommunityProvider>
            </AuthProvider>
          </QueryClientProvider>
        </LivingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
