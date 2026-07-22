import { createLivingClient } from '@living/living-sdk';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/** The single SDK instance for the resident app. Same client as the portal —
 *  no component ever calls fetch. Bounces to /login after a failed refresh. */
export const living = createLivingClient({
  baseUrl,
  onUnauthorized: () => {
    if (window.location.pathname !== '/login') window.location.assign('/login');
  },
});
