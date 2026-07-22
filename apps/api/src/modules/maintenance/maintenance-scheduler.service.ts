import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { MaintenanceGenerationService } from './maintenance-generation.service';

/**
 * Runs every minute, generating Work Orders for all plans whose nextRunAt has
 * passed. Idempotency lives in the generation service (compare-and-swap on
 * nextRunAt); this only guards against overlapping ticks within one instance.
 * Set PM_SCHEDULER_ENABLED=false to disable on a given instance (e.g. a worker
 * split, or CI).
 */
@Injectable()
export class MaintenanceSchedulerService {
  private readonly logger = new Logger(MaintenanceSchedulerService.name);
  private running = false;

  constructor(private readonly generation: MaintenanceGenerationService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'preventive-maintenance' })
  async tick(): Promise<void> {
    if (process.env.PM_SCHEDULER_ENABLED === 'false') return;
    if (this.running) return; // a previous tick is still working — skip this one
    this.running = true;
    try {
      const { processed } = await this.generation.processDuePlans();
      if (processed > 0) this.logger.log(`Generated ${processed} preventive-maintenance work order(s)`);
    } catch (err) {
      this.logger.error('Preventive-maintenance tick failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
