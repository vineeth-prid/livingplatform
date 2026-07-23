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
      const dead = attempt >= maxAttempts;
      await this.tracking.markAttemptFailed(job.data.deliveryId, {
        error: (err as Error).message, retryCount: attempt, durationMs, dead,
      });
      if (dead) await this.deadLetter(job, (err as Error).message);
      this.logger.warn({
        event: 'notification', status: dead ? 'dead-letter' : 'retry-scheduled',
        channel: job.data.channel, deliveryId: job.data.deliveryId, jobId: job.id, attempt, maxAttempts,
        error: (err as Error).message,
      });
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
