import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@living/design-system';
import { AuthProvider, LivingProvider, createQueryClient } from '@living/hooks';
import {
  CommandPaletteProvider,
  ConfirmProvider,
  ErrorBoundary,
  ToastProvider,
  TooltipProvider,
} from '@living/ui';

import { CommunityProvider } from './features/community/community-context';
import { living } from './lib/living';

const queryClient = createQueryClient();

/**
 * The full provider stack, composed once. Order matters: SDK → Query → Auth
 * (needs both) → UI providers. Every app in the monorepo wires the same stack.
 */
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
                    <CommandPaletteProvider>
                      {children}
                      <ToastProvider />
                    </CommandPaletteProvider>
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
