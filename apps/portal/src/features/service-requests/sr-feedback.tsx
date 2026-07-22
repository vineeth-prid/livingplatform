import { useState } from 'react';
import { Star } from 'lucide-react';
import { LivingApiError } from '@living/living-sdk';
import { cn } from '@living/utils';
import { Button, toast } from '@living/ui';
import type { ServiceRequest } from '@living/types';

import { useServiceRequestFeedback, useServiceRequestMutations } from './queries';

/**
 * Resident feedback — a 1–5 rating + optional comment, available only after the
 * request is COMPLETED (mirrors the backend rule). Shows existing feedback,
 * otherwise offers the form to users who can view the request.
 */
export function ServiceFeedback({ request }: { request: ServiceRequest }) {
  const completed = request.status === 'COMPLETED';
  const { data } = useServiceRequestFeedback(request.id, completed);
  const { submitFeedback } = useServiceRequestMutations(request.id);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  if (!completed) {
    return <p className="text-sm text-subtle">Feedback opens once the request is completed.</p>;
  }

  if (data) {
    return (
      <div className="flex flex-col gap-2">
        <Stars value={data.rating} readOnly />
        {data.comment && <p className="text-sm text-body">“{data.comment}”</p>}
      </div>
    );
  }

  async function submit() {
    if (rating < 1) return;
    try {
      await submitFeedback.mutateAsync({ rating, comment: comment || undefined });
      toast.success('Thanks for the feedback');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not submit feedback');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Stars value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How did it go? (optional)"
        rows={2}
        className="rounded-control border border-border bg-raised px-3 py-2 text-sm text-strong outline-none transition-shadow focus-visible:shadow-ring"
      />
      <Button size="sm" className="self-start" loading={submitFeedback.isPending} disabled={rating < 1} onClick={submit}>
        Submit feedback
      </Button>
    </div>
  );
}

function Stars({ value, onChange, readOnly }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={cn('transition-transform', !readOnly && 'hover:scale-110')}
        >
          <Star className={cn('h-5 w-5', n <= value ? 'fill-[var(--warning-solid)] text-[var(--warning-solid)]' : 'text-border')} />
        </button>
      ))}
    </div>
  );
}
