import { type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import {
  Avatar, Button, Card, CardHeader, CardTitle, EmptyState, ErrorState,
  LoadingState, PageContainer, PageTransition,
} from '@living/ui';

/** Detail page shell: handles loading / error / not-found so module detail
 *  pages only render the happy path. */
export function DetailShell({
  isLoading, isError, error, notFound, backTo, children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  notFound?: boolean;
  backTo: string;
  children: ReactNode;
}) {
  return (
    <PageTransition>
      <PageContainer>
        <Link
          to={backTo}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-body"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState error={error} />
        ) : notFound ? (
          <EmptyState title="Not found" description="This record no longer exists." />
        ) : (
          children
        )}
      </PageContainer>
    </PageTransition>
  );
}

/** Large profile header: avatar/mark, title, subtitle, status, and actions. */
export function DetailHeader({
  name, title, subtitle, avatarUrl, showAvatar = true, status, actions, meta,
}: {
  name?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  avatarUrl?: string | null;
  showAvatar?: boolean;
  status?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <Card variant="elevated" className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {showAvatar && <Avatar name={name ?? String(title)} src={avatarUrl} size="lg" />}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-h2 leading-none tracking-tight text-strong">{title}</h1>
              {status}
            </div>
            {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
            {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </Card>
  );
}

/** A titled card section for grouped detail content. */
export function DetailSection({
  title, action, children, className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card variant="elevated" className={className}>
      <div className="mb-4 flex items-center justify-between">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-subtle">{title}</CardTitle>
        </CardHeader>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** A label / value pair. `mono` for codes, numbers and money. */
export function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className={`mt-0.5 text-sm text-body ${mono ? 'font-mono' : ''}`} data-numeric={mono ? '' : undefined}>
        {empty ? <span className="text-subtle">—</span> : value}
      </dd>
    </div>
  );
}

export function FieldGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <dl className={`grid gap-x-6 gap-y-4 ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {children}
    </dl>
  );
}

/** A calm placeholder for a section whose data arrives in a future sprint. */
export function PlaceholderSection({ title, note }: { title: string; note: string }) {
  return (
    <DetailSection title={title}>
      <p className="text-sm text-subtle">{note}</p>
    </DetailSection>
  );
}

export { Button as DetailButton };
