import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { bootCommunityTheme } from '@living/design-system';
import { recoverFromStaleBuild } from '@living/ui';

import { AppProviders } from './providers';
import { router } from './router';
import './styles.css';

// The community's colours before the first paint — no flash of Living green.
bootCommunityTheme();
// An installed app still on the previous deploy reloads instead of failing to open screens.
recoverFromStaleBuild();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
