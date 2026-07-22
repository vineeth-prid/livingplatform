import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  resource: string;
  resourceId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  tenantId?: string | null;
  communityId?: string | null;
  method?: string;
  path?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes the append-only audit trail. Records are best-effort and must never
 * break the request they describe — failures are logged, not thrown.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          actorId: entry.actorId ?? null,
          actorEmail: entry.actorEmail ?? null,
          tenantId: entry.tenantId ?? null,
          communityId: entry.communityId ?? null,
          method: entry.method,
          path: entry.path,
          statusCode: entry.statusCode,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          metadata: entry.metadata,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${entry.action}`,
        err as Error,
      );
    }
  }
}
