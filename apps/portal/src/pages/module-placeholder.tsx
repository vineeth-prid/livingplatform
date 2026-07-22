import { type ComponentType } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Hammer } from 'lucide-react';
import { Button, EmptyState, PageContainer, PageHeader, PageTransition } from '@living/ui';

/**
 * Graceful placeholder for module routes the dashboard links to (tickets,
 * work orders, …) that are built in later feature sprints. Keeps every
 * navigation target coherent instead of 404-ing.
 */
export function ModulePlaceholder({
  title,
  icon = Hammer,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <PageTransition>
      <PageContainer>
        <PageHeader eyebrow="Operations" title={title} />
        <EmptyState
          icon={icon}
          title={`${title} arrives in an upcoming sprint`}
          description="This module is built on the same foundation and SDK the dashboard already uses."
          action={
            <Button asChild variant="secondary">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </Link>
            </Button>
          }
        />
      </PageContainer>
    </PageTransition>
  );
}
