import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { NOTIFICATION_DLQ, NOTIFICATION_JOB, NOTIFICATION_QUEUE } from '../notification.constants';
import { NotificationDispatcher, type NotificationJobData } from './notification.dispatcher';
import { DeliveryTracker } from './delivery-tracker';

/** Per-attempt backoff (ms): 1m, 5m, 15m, 1h by default (EMAIL_RETRY_BACKOFF_MS,
 *  shared across channels). Extracted from the Email sprint's retry logic. */
function backoffMs(): number[] {
  return (process.env.EMAIL_RETRY_BACKOFF_MS ?? '60000,300000,900000,3600000')
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function concurrency(): number {
  return Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY ?? process.env.EMAIL_QUEUE_CONCURRENCY ?? 5);
}

/**
 * The ONE shared notification worker. Every channel's messages flow through here:
 * it delivers via the dispatcher (which routes to the channel), and on failure
 * BullMQ reschedules with the shared backoff (1m → 5m → 15m → 1h). When attempts
 * are exhausted the job is copied to the Dead Letter Queue and the delivery row
 * is marked DEAD_LETTER. Channels never retry themselves.
 */
@Processor(NOTIFICATION_QUEUE, {
  concurrency: concurrency(),
  settings: {
    backoffStrategy: (attemptsMade: number): number => {
      const delays = backoffMs();
      return delays[Math.min(Math.max(attemptsMade - 1, 0), delays.length - 1)] ?? 3_600_000;
    },
  },
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly tracking: DeliveryTracker,
    @InjectQueue(NOTIFICATION_DLQ) private readonly dlq: Queue<NotificationJobData & { error: string }>,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<{ messageId: string | null }> {
    const start = Date.now();
    const attempt = job.attemptsMade + 1;
    try {
      const result = await this.dispatcher.deliver(job.data, attempt - 1);
      return { messageId: result.messageId };
    } catch (err) {
      const durationMs = Date.now() - start;
      const maxAttempts = job.opts.attempts ?? 1;
      // A 4xx from a channel is a statement about the MESSAGE, not about the
      // transport: "no push device registered", "VAPID keys not configured",
      // "invalid recipient". Retrying those on the shared 1m → 5m → 15m → 1h
      // backoff cannot change the outcome, and it holds a worker slot for an
      // hour per message while genuinely retryable work queues behind it.
      const dead = attempt >= maxAttempts || isPermanent(err);
      await this.tracking.markAttemptFailed(job.data.deliveryId, {
        error: (err as Error).message, retryCount: attempt, durationMs, dead,
      });
      if (dead) await this.deadLetter(job, (err as Error).message);
      this.logger.warn({
        event: 'notification',
        status: dead ? (isPermanent(err) ? 'failed-permanently' : 'dead-letter') : 'retry-scheduled',
        channel: job.data.channel, deliveryId: job.data.deliveryId, jobId: job.id, attempt, maxAttempts,
        error: (err as Error).message,
      });
      // Swallowing a permanent failure tells BullMQ the job SUCCEEDED, which is
      // what stops it being rescheduled. It is already recorded as failed on the
      // delivery row and copied to the DLQ, so nothing is lost.
      if (isPermanent(err)) return { messageId: null };
      throw err;
    }
  }

  private async deadLetter(job: Job<NotificationJobData>, error: string): Promise<void> {
    try {
      await this.dlq.add(NOTIFICATION_JOB, { ...job.data, error }, { removeOnComplete: false, removeOnFail: false });
    } catch (e) {
      this.logger.error(`Failed to move job ${job.id} to DLQ: ${(e as Error).message}`);
    }
  }
}

/**
 * A 4xx from a channel describes the MESSAGE, not the transport — no push
 * device registered, VAPID keys unset, invalid recipient. None of those change
 * on a retry, so they are failed permanently instead of occupying a worker slot
 * through the full 1m → 5m → 15m → 1h backoff.
 *
 * Anything else (network blip, provider 5xx, Redis hiccup) stays retryable.
 */
function isPermanent(err: unknown): boolean {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500;
}
