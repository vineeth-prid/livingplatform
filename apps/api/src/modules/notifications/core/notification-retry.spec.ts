import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import type { DeliveryTracker } from './delivery-tracker';
import type { NotificationDispatcher, NotificationJobData } from './notification.dispatcher';
import { NotificationProcessor } from './notification.processor';

function makeProcessor(failWith?: Error) {
  const dispatcher = {
    deliver: failWith
      ? jest.fn().mockRejectedValue(failWith)
      : jest.fn().mockResolvedValue({ messageId: 'm-1' }),
  } as unknown as NotificationDispatcher;

  const tracking = { markAttemptFailed: jest.fn().mockResolvedValue(null) } as unknown as DeliveryTracker;
  const dlq = { add: jest.fn().mockResolvedValue(null) } as unknown as Queue;

  return { processor: new NotificationProcessor(dispatcher, tracking, dlq), tracking, dlq };
}

const job = (attemptsMade = 0): Job<NotificationJobData> =>
  ({
    id: 'job-1',
    attemptsMade,
    opts: { attempts: 5 },
    data: { deliveryId: 'del-1', channel: 'push', message: { channel: 'push', to: 'user-1' } },
  }) as unknown as Job<NotificationJobData>;

/**
 * Retrying a message the channel REJECTED cannot change the outcome.
 *
 * "No push device registered" and "VAPID keys are not configured" are the two a
 * gate delivery hits most, and on the shared backoff each one held a worker slot
 * for over an hour while genuinely retryable work queued behind it.
 */
describe('NotificationProcessor — permanent vs retryable failures', () => {
  it('fails a 4xx permanently instead of rescheduling it', async () => {
    const { processor, tracking, dlq } = makeProcessor(
      new BadRequestException('No push devices registered for this recipient'),
    );

    // Resolving (not throwing) is what tells BullMQ to stop rescheduling.
    await expect(processor.process(job())).resolves.toEqual({ messageId: null });

    expect(tracking.markAttemptFailed).toHaveBeenCalledWith(
      'del-1',
      expect.objectContaining({ dead: true }),
    );
    // Still recorded — nothing is lost by not retrying it.
    expect(dlq.add).toHaveBeenCalled();
  });

  it('keeps retrying a 5xx / transport failure', async () => {
    const { processor, tracking, dlq } = makeProcessor(
      new InternalServerErrorException('push service unavailable'),
    );

    await expect(processor.process(job())).rejects.toThrow();

    expect(tracking.markAttemptFailed).toHaveBeenCalledWith(
      'del-1',
      expect.objectContaining({ dead: false }),
    );
    expect(dlq.add).not.toHaveBeenCalled();
  });

  it('keeps retrying a plain Error with no status', async () => {
    const { processor, tracking } = makeProcessor(new Error('socket hang up'));

    await expect(processor.process(job())).rejects.toThrow();
    expect(tracking.markAttemptFailed).toHaveBeenCalledWith(
      'del-1',
      expect.objectContaining({ dead: false }),
    );
  });

  it('still dead-letters a retryable failure once attempts are exhausted', async () => {
    const { processor, dlq } = makeProcessor(new Error('socket hang up'));

    await expect(processor.process(job(4))).rejects.toThrow();
    expect(dlq.add).toHaveBeenCalled();
  });

  it('passes a successful delivery straight through', async () => {
    const { processor, tracking } = makeProcessor();

    await expect(processor.process(job())).resolves.toEqual({ messageId: 'm-1' });
    expect(tracking.markAttemptFailed).not.toHaveBeenCalled();
  });
});
