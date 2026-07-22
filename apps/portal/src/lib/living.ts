import { createLivingClient } from '@living/living-sdk';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/**
 * The single SDK instance for the portal. `onUnauthorized` bounces to /login
 * after a failed token refresh (set once here, honoured everywhere).
 */
export const living = createLivingClient({
  baseUrl,
  onUnauthorized: () => {
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  },
});
