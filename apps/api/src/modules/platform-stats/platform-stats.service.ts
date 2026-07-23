import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

import { paginate, type Paginated } from '../../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { ROLE_KEYS } from '../rbac/rbac.constants';
import { QueryAuditDto } from './dto/query-audit.dto';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Point { label: string; value: number }

const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

/** Cumulative count by month over the last `months`, from a list of dates. */
function cumulativeTrend(dates: Date[], months = 6): Point[] {
  const now = new Date();
  const out: Point[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = MONTHS[new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth()]!;
    out.push({ label, value: dates.filter((d) => d < end).length });
  }
  return out;
}

/**
 * Platform-wide aggregates for the Platform Admin portal. Every number here is a
 * live DB read — no mock data. Where a metric has no historical store yet
 * (performance timeseries, occupancy history) the series is simply empty; it
 * fills in on its own once the data exists.
 */
@Injectable()
export class PlatformStatsService {
  private readonly logger = new Logger(PlatformStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  async overview() {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 864e5);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [communities, users, residentUnits, units] = await Promise.all([
      this.prisma.community.findMany({
        where: { deletedAt: null },
        select: { status: true, state: true, city: true, type: true, createdAt: true },
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: { createdAt: true, lastLoginAt: true },
      }),
      this.prisma.residentUnit.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.unit.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
    ]);

    const [residentCount, adminCount, distinctOccupied] = await Promise.all([
      this.prisma.resident.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, roles: { some: { role: { key: ROLE_KEYS.ASSOCIATION_ADMIN } } } },
      }),
      this.prisma.residentUnit.findMany({ distinct: ['unitId'], select: { unitId: true } }),
    ]);

    // ── communities ──
    const tally = (key: (c: (typeof communities)[number]) => string | null) => {
      const m = new Map<string, number>();
      for (const c of communities) { const k = key(c); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
      return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    const active = communities.filter((c) => c.status === 'ACTIVE').length;
    const suspended = communities.filter((c) => c.status === 'INACTIVE').length;
    const archived = communities.filter((c) => c.status === 'ARCHIVED').length;

    // ── users ──
    const byRole = new Map(residentUnits.map((r) => [r.role, r._count._all]));
    const owners = byRole.get('OWNER') ?? 0;
    const tenants = byRole.get('TENANT') ?? 0;
    const mau = users.filter((u) => u.lastLoginAt && u.lastLoginAt >= monthAgo).length;
    const dau = users.filter((u) => u.lastLoginAt && u.lastLoginAt >= startOfDay).length;

    // ── units ──
    const unitByStatus = new Map(units.map((u) => [u.status, u._count._all]));
    const totalUnits = units.reduce((s, u) => s + u._count._all, 0);
    const occupied = unitByStatus.get('OCCUPIED') ?? 0;
    const residentUnitTotal = residentUnits.reduce((s, r) => s + r._count._all, 0);

    return {
      communities: {
        total: communities.length,
        active, suspended, archived,
        newThisMonth: communities.filter((c) => c.createdAt >= monthAgo).length,
        newToday: communities.filter((c) => c.createdAt >= startOfDay).length,
        byState: tally((c) => c.state).slice(0, 8),
        byCity: tally((c) => c.city).slice(0, 8),
        byType: tally((c) => typeLabel(c.type)),
        growthTrend: cumulativeTrend(communities.map((c) => c.createdAt)),
      },
      users: {
        total: users.length,
        admins: adminCount,
        owners, tenants,
        residents: residentCount,
        active: mau,
        mau, dau,
        newToday: users.filter((u) => u.createdAt >= startOfDay).length,
        newThisMonth: users.filter((u) => u.createdAt >= monthAgo).length,
        growth: cumulativeTrend(users.map((u) => u.createdAt)),
        ownerVsTenant: [{ label: 'Owners', value: owners }, { label: 'Tenants', value: tenants }],
      },
      units: {
        total: totalUnits,
        occupied,
        occupancyPct: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
        avgPerCommunity: communities.length ? Math.round(totalUnits / communities.length) : 0,
        avgResidentsPerUnit: distinctOccupied.length
          ? Math.round((residentUnitTotal / distinctOccupied.length) * 10) / 10
          : 0,
      },
    };
  }

  async audit(query: QueryAuditDto): Promise<Paginated<unknown>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.resource ? { resource: query.resource } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.status === 'ok' ? { statusCode: { lt: 400 } } : {}),
      ...(query.status === 'fail' ? { statusCode: { gte: 400 } } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { actorEmail: { contains: query.search, mode: 'insensitive' } },
              { action: { contains: query.search, mode: 'insensitive' } },
              { ipAddress: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  /** Real security/activity counters over a trailing window (default 24h). */
  async auditSummary(hours = 24) {
    const since = new Date(Date.now() - hours * 3_600_000);
    const base = { createdAt: { gte: since } };
    const count = (where: Prisma.AuditLogWhereInput) =>
      this.prisma.auditLog.count({ where: { ...base, ...where } });
    const like = (s: string): Prisma.StringFilter => ({ contains: s, mode: 'insensitive' });

    // Actions are `<resource>.<verb>` (auth.login, users.update, …); auth paths
    // keep their last segment. Community provisioning + login-as both land under
    // /admin/communities, so those two use the request path to disambiguate.
    const [logins, failedLogins, passwordResets, roleChanges, permissionChanges, communitiesCreated, loginAs, total, errors] =
      await Promise.all([
        count({ action: like('login'), statusCode: { lt: 400 } }),
        count({ action: like('login'), statusCode: { gte: 400 } }),
        count({ action: like('password') }),
        count({ OR: [{ resource: like('role') }, { path: like('/roles') }] }),
        count({ resource: like('permission') }),
        count({ method: 'POST', path: like('/admin/communities'), NOT: { path: like('login-as') } }),
        count({ path: like('login-as') }),
        count({}),
        count({ statusCode: { gte: 400 } }),
      ]);

    return {
      windowHours: hours,
      logins, failedLogins, passwordResets, roleChanges, permissionChanges, communitiesCreated, loginAs,
      totalEvents: total,
      errorRatePct: total ? Math.round((errors / total) * 1000) / 10 : 0,
    };
  }

  /** Distinct modules present in the audit log — powers the filter dropdown. */
  async auditModules(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({ distinct: ['resource'], select: { resource: true } });
    return rows.map((r) => r.resource).filter(Boolean).sort();
  }

  async system() {
    const [app, storage, jobs, versions] = await Promise.all([
      this.appInfo(),
      this.storageStats(),
      this.jobs(),
      this.versions(),
    ]);
    return { app, storage, jobs, versions };
  }

  private appInfo() {
    const uptimeSec = Math.floor(process.uptime());
    const d = Math.floor(uptimeSec / 86400);
    const h = Math.floor((uptimeSec % 86400) / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    return {
      version: process.env.APP_VERSION ?? '1.0.0',
      releaseVersion: process.env.RELEASE_VERSION ?? process.env.APP_VERSION ?? 'v1.0.0',
      buildDate: process.env.BUILD_DATE ?? null,
      environment: process.env.NODE_ENV ?? 'development',
      uptime: `${d}d ${h}h ${m}m`,
      nodeVersion: process.version,
      storageDriver: this.storage.driver,
    };
  }

  private async storageStats() {
    const [docs, tix, wo, byCommunityRows, communities] = await Promise.all([
      this.prisma.communityDocument.aggregate({ _sum: { fileSize: true }, where: { deletedAt: null } }),
      this.prisma.ticketAttachment.aggregate({ _sum: { size: true }, where: { deletedAt: null } }),
      this.prisma.workOrderAttachment.aggregate({ _sum: { size: true } }),
      this.prisma.communityDocument.groupBy({
        by: ['communityId'], _sum: { fileSize: true }, where: { deletedAt: null },
      }),
      this.prisma.community.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    ]);
    const nameById = new Map(communities.map((c) => [c.id, c.name]));
    const usedBytes = (docs._sum.fileSize ?? 0) + (tix._sum.size ?? 0) + (wo._sum.size ?? 0);
    const byCommunity = byCommunityRows
      .map((r) => ({ label: nameById.get(r.communityId) ?? '—', value: Math.round(((r._sum.fileSize ?? 0) / 1e6) * 10) / 10 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return {
      usedMb: Math.round((usedBytes / 1e6) * 10) / 10,
      communityStorageMb: Math.round(((docs._sum.fileSize ?? 0) / 1e6) * 10) / 10,
      byCommunity,
    };
  }

  private jobs() {
    const scheduled: { name: string; next: string | null }[] = [];
    try {
      for (const [name, job] of this.scheduler.getCronJobs()) {
        let next: string | null = null;
        try { next = job.nextDate().toJSDate().toISOString(); } catch { /* not scheduled */ }
        scheduled.push({ name, next });
      }
    } catch (e) {
      this.logger.warn(`Could not read scheduler registry: ${(e as Error).message}`);
    }
    // No durable job-run history yet — running/failed/retry are tracked as empty.
    return { scheduled, running: [], failed: [], retryQueue: [], pending: scheduled.length };
  }

  private async versions() {
    let database: string | null = null;
    let redis: string | null = null;
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ version: string }[]>('SELECT version()');
      database = rows[0]?.version?.split(',')[0] ?? null; // "PostgreSQL 16.3 on ..."
    } catch (e) {
      this.logger.warn(`DB version probe failed: ${(e as Error).message}`);
    }
    try {
      const info = await this.redis.info('server');
      redis = /redis_version:([^\r\n]+)/.exec(info)?.[1]?.trim() ?? null;
    } catch (e) {
      this.logger.warn(`Redis version probe failed: ${(e as Error).message}`);
    }
    return { database, redis };
  }
}
