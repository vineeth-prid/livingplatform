import { Link } from '@tanstack/react-router';
import { Button } from '@living/ui';

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-page p-6 text-center">
      <p className="font-display text-display-xl leading-none tracking-tight text-brand">404</p>
      <div>
        <h1 className="font-display text-h2 tracking-tight text-strong">Nothing here.</h1>
        <p className="mt-1.5 text-muted">The page you’re looking for doesn’t exist.</p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Back to Living</Link>
      </Button>
    </div>
  );
}
