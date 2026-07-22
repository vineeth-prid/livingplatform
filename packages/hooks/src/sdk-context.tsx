import { createContext, useContext, type ReactNode } from 'react';
import type { LivingClient } from '@living/living-sdk';

const LivingContext = createContext<LivingClient | null>(null);

/** Provides the single LivingClient instance to the tree. */
export function LivingProvider({
  client,
  children,
}: {
  client: LivingClient;
  children: ReactNode;
}) {
  return <LivingContext.Provider value={client}>{children}</LivingContext.Provider>;
}

/** Access the SDK from any component/hook. */
export function useLiving(): LivingClient {
  const client = useContext(LivingContext);
  if (!client) throw new Error('useLiving must be used within a <LivingProvider>');
  return client;
}
