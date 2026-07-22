import { type ReactNode } from 'react';
import { cn } from '@living/utils';

import { Card, CardDescription, CardHeader, CardTitle } from './card';

/**
 * Thin card frame for charts. The foundation ships the wrapper only (no charting
 * dependency yet) — feature sprints drop a chart library into `children`. Keeps
 * chart framing consistent platform-wide.
 */
export function ChartWrapper({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card variant="elevated" className={cn('flex flex-col', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4">
          <CardHeader>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          {actions}
        </div>
      )}
      <div className="mt-4 flex-1">{children}</div>
    </Card>
  );
}
