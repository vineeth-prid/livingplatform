import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

/**
 * Minimal Prometheus-format metrics endpoint (process-level only).
 *
 * ponytail: hand-rolled exposition format — no prom-client dependency for the
 * three metrics we can emit today. Swap in prom-client / OpenTelemetry when
 * real application metrics (request counters, histograms) are needed; the
 * `/metrics` contract stays the same.
 */
@Controller('metrics')
export class MetricsController {
  @Public()
  @SkipTransform()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiExcludeEndpoint()
  metrics(): string {
    const mem = process.memoryUsage();
    const lines = [
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime().toFixed(0)}`,
      '# HELP process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${mem.rss}`,
      '# HELP nodejs_heap_used_bytes Node.js heap used in bytes.',
      '# TYPE nodejs_heap_used_bytes gauge',
      `nodejs_heap_used_bytes ${mem.heapUsed}`,
    ];
    return lines.join('\n') + '\n';
  }
}
