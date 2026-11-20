import { Link } from '@tanstack/react-router';
import { PowerOff } from 'lucide-react';
import { Card } from '@living/ui';

/**
 * Shown where the Services section would be while a community has it switched
 * off — an old link or bookmark lands here instead of on a broken page.
 */
export function ServicesOffNotice({ detail }: { detail?: string }) {
  return (
    <Card variant="elevated" className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-sunken text-subtle">
        <PowerOff className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-strong">Services are turned off for this community</p>
        <p className="mt-0.5 text-sm text-muted">
          {detail ?? 'Residents cannot see or book services, and the catalogue cannot be changed.'} Each service keeps its own
          on/off for when the section is switched back on.
        </p>
        <Link to={'/settings' as string} className="mt-1 inline-block text-sm text-brand hover:underline">
          Turn Services on in Settings →
        </Link>
      </div>
    </Card>
  );
}
