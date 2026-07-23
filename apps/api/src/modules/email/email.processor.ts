import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { EMAIL_DLQ, EMAIL_JOB, EMAIL_QUEUE } from './email.constants';
import { EmailService, type EmailJobData } from './email.service';
import { EmailTrackingService } from './email.tracking.service';

/** Per-attempt backoff (ms): 1m, 5m, 15m, 1h by default (EMAIL_RETRY_BACKOFF_MS). */
function backoffMs(): number[] {
  return (process.env.EMAIL_RETRY_BACKOFF_MS ?? '60000,300000,900000,3600000')
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function concurrency(): number {
  return Number(process.env.EMAIL_QUEUE_CONCURRENCY ?? 5);
}

/**
 * BullMQ worker for the email queue. One provider send per attempt; on failure
 * BullMQ reschedules using the custom backoff (1m → 5m → 15m → 1h). When all
 * attempts are exhausted the job is copied to the Dead Letter Queue and the
 * delivery row is marked DEAD_LETTER. The provider itself never retries.
 */
@Processor(EMAIL_QUEUE, {
  concurrency: concurrency(),
  settings: {
    backoffStrategy: (attemptsMade: number): number => {
      const delays = backoffMs();
      return delays[Math.min(Math.max(attemptsMade - 1, 0), delays.length - 1)] ?? 3_600_000;
    },
  },
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly email: EmailService,
    private readonly tracking: EmailTrackingService,
    @InjectQueue(EMAIL_DLQ) private readonly dlq: Queue<EmailJobData & { error: string }>,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<{ messageId: string | null }> {
    const start = Date.now();
    const attempt = job.attemptsMade + 1; // 1-based for this run
    try {
      const result = await this.email.deliver(job.data, attempt - 1);
      return { messageId: result.messageId };
    } catch (err) {
      const durationMs = Date.now() - start;
      const maxAttempts = job.opts.attempts ?? 1;
      const dead = attempt >= maxAttempts;
      await this.tracking.markAttemptFailed(job.data.deliveryId, {
        error: (err as Error).message,
        retryCount: attempt,
        durationMs,
        dead,
      });
      if (dead) {
        await this.deadLetter(job, (err as Error).message);
      }
      this.logger.warn({
        event: 'email', status: dead ? 'dead-letter' : 'retry-scheduled',
        deliveryId: job.data.deliveryId, jobId: job.id, attempt, maxAttempts,
        error: (err as Error).message,
      });
      throw err; // let BullMQ record the attempt / schedule the retry
    }
  }

  private async deadLetter(job: Job<EmailJobData>, error: string): Promise<void> {
    try {
      await this.dlq.add(EMAIL_JOB, { ...job.data, error }, { removeOnComplete: false, removeOnFail: false });
    } catch (e) {
      this.logger.error(`Failed to move job ${job.id} to DLQ: ${(e as Error).message}`);
    }
  }
}
