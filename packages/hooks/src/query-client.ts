import { QueryClient } from '@tanstack/react-query';
import { LivingApiError } from '@living/living-sdk';

/**
 * Shared TanStack Query configuration. Never retries client (4xx) errors —
 * those are deterministic — and keeps focus-refetch off for a calm feel.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof LivingApiError && error.statusCode < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
