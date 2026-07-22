import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@living/design-system';
import {
  Badge, Button, Card, PageContainer, PageHeader, PageTransition,
  ThemeSwitch, ToastProvider, TooltipProvider,
} from '@living/ui';
import './styles.css';

/**
 * Workforce app — a thin runnable scaffold for staff/vendor field work. Like the
 * resident app, it reuses the SAME shared packages as the portal. Workforce
 * screens (assigned tickets, work orders) are built in a later sprint.
 */
function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <PageTransition>
          <div className="min-h-dvh bg-page">
            <PageContainer size="md">
              <div className="flex justify-end pb-4">
                <ThemeSwitch />
              </div>
              <PageHeader
                eyebrow="Living · Workforce"
                title="Workforce app foundation"
                description="Staff and vendors execute assigned work here — built entirely on the shared foundation."
              />
              <Card variant="elevated" className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Badge tone="brand" dot>Shared UI</Badge>
                  <Badge tone="info" dot>Same SDK</Badge>
                </div>
                <p className="text-sm text-muted">
                  Assigned tickets, work orders and progress updates arrive in a later
                  sprint, using the same <code className="font-mono text-xs">living-sdk</code>.
                </p>
                <Button variant="accent" className="self-start">Open my queue</Button>
              </Card>
            </PageContainer>
            <ToastProvider />
          </div>
        </PageTransition>
      </TooltipProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
