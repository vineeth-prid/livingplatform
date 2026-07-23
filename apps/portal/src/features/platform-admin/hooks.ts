import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Community } from '@living/types';

import { living } from '../../lib/living';
import type { Point } from './charts';

/**
 * Platform Admin data layer.
 *
 * REAL adapters consume existing endpoints (communities, /health/ready).
 * MOCK adapters are clearly marked — they return deterministic placeholder data
 * for metrics the backend does not yet expose (users aggregate, MAU/DAU,
 * performance, jobs, storage, versions, audit log). No endpoints are invented;
 * swap a MOCK body for a real call when the endpoint lands — the hook shape stays.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── REAL: communities ────────────────────────────────────────────────────────

export function usePlatformCommunities() {
  return useQuery({
    queryKey: ['platform', 'communities'],
    queryFn: () => living.community.list({ limit: 500, sortBy: 'createdAt', sortDir: 'asc' }),
    staleTime: 60_000,
  });
}

export interface CommunityGrowth {
  total: number; active: number; suspended: number; newThisMonth: number; newToday: number;
  byState: Point[]; byCity: Point[]; byType: Point[]; growthTrend: Point[]; sizeDistribution: Point[];
  growthRatePct: number;
}

/** REAL: derives every Community Growth metric from the communities list. */
export function useCommunityGrowth(): { data: CommunityGrowth | undefined; isLoading: boolean } {
  const q = usePlatformCommunities();
  const data = useMemo(() => {
    const items = q.data?.items;
    if (!items) return undefined;
    return deriveCommunityGrowth(items);
  }, [q.data]);
  return { data, isLoading: q.isLoading };
}

export function deriveCommunityGrowth(items: Community[]): CommunityGrowth {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 864e5);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const active = items.filter((c) => c.status === 'ACTIVE').length;
  const suspended = items.filter((c) => c.status === 'INACTIVE' || c.status === 'ARCHIVED').length;
  const created = (c: Community) => new Date(c.createdAt ?? now);
  const newThisMonth = items.filter((c) => created(c) >= monthAgo).length;
  const newToday = items.filter((c) => created(c) >= startOfDay).length;

  const tally = (key: (c: Community) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const c of items) {
      const k = key(c);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  // Cumulative growth trend over the last 6 months.
  const trend: Point[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = items.filter((c) => created(c) < end).length;
    trend.push({ label: MONTHS[d.getMonth()]!, value: count });
  }
  const prev = trend[trend.length - 2]?.value ?? 0;
  const last = trend[trend.length - 1]?.value ?? 0;
  const growthRatePct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;

  return {
    total: items.length, active, suspended, newThisMonth, newToday,
    byState: tally((c) => c.state).slice(0, 8),
    byCity: tally((c) => c.city).slice(0, 8),
    byType: tally((c) => typeLabel(c.type)),
    growthTrend: trend,
    sizeDistribution: tally((c) => typeLabel(c.type)),
    growthRatePct,
  };
}

const typeLabel = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

// ── REAL: platform health (/health/ready) ────────────────────────────────────

export interface HealthStatus { name: string; ok: boolean }

interface ReadinessResponse {
  status?: string;
  details?: Record<string, { status?: string }>;
}

export function usePlatformHealth() {
  return useQuery({
    queryKey: ['platform', 'health'],
    // /health/ready returns 503 with a body when unhealthy — capture either.
    queryFn: async (): Promise<{ overall: boolean; deps: HealthStatus[] }> => {
      // /health/ready returns 503 (with the same body) when a dependency is
      // down — the SDK surfaces that body on LivingApiError.raw.
      const res = await living.platform.readiness<ReadinessResponse>().catch((e: unknown) => {
        const raw = (e as { raw?: ReadinessResponse })?.raw;
        return raw ?? { status: 'error', details: {} };
      });
      const details = res.details ?? {};
      const pick = (key: string, name: string): HealthStatus => ({
        name, ok: (details[key]?.status ?? 'down') === 'up',
      });
      const deps = [
        pick('database', 'PostgreSQL'),
        pick('redis', 'Redis'),
        pick('storage', 'MinIO'),
        pick('memory_heap', 'Memory'),
      ];
      return { overall: res.status === 'ok', deps };
    },
    refetchInterval: 30_000,
  });
}

// ── MOCK adapters (placeholders — no endpoint yet) ────────────────────────────

/** MOCK: platform-wide user aggregates. Scaled off the real community count so
 *  numbers stay internally consistent. Replace with a /admin/stats/users call. */
export function usePlatformUsers() {
  const { data: communities } = usePlatformCommunities();
  return useMemo(() => {
    const n = communities?.items.length ?? 0;
    const owners = n * 42;
    const tenants = n * 18;
    const residents = owners + tenants;
    const admins = n;
    const userGrowth: Point[] = MONTHS.slice(0, 6).map((label, i) => ({ label, value: Math.round(residents * (0.6 + i * 0.08)) }));
    return {
      __mock: true,
      totalUsers: residents + admins,
      owners, tenants, residents, admins,
      activeUsers: Math.round(residents * 0.72),
      mau: Math.round(residents * 0.61),
      dau: Math.round(residents * 0.23),
      userGrowth,
      ownerVsTenant: [{ label: 'Owners', value: owners }, { label: 'Tenants', value: tenants }] as Point[],
    };
  }, [communities]);
}

/** MOCK: occupancy / business intelligence. Replace with /admin/stats/units. */
export function useBusinessIntelligence() {
  const { data: communities } = usePlatformCommunities();
  return useMemo(() => {
    const n = communities?.items.length ?? 0;
    const totalUnits = n * 120;
    const occupied = Math.round(totalUnits * 0.78);
    const occupancyTrend: Point[] = MONTHS.slice(0, 6).map((label, i) => ({ label, value: 70 + i * 1.5 }));
    return {
      __mock: true,
      totalUnits, occupied,
      occupancyPct: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
      avgUnitsPerCommunity: n ? Math.round(totalUnits / n) : 0,
      avgResidentsPerUnit: 2.4,
      occupancyTrend,
    };
  }, [communities]);
}

/** MOCK: performance metrics. Replace with a real metrics/Prometheus scrape. */
export function usePerformanceMetrics() {
  return useMemo(() => ({
    __mock: true,
    apiRequests: seededSeries(24, 800, 400).map((v, i) => ({ label: `${i}:00`, value: v })),
    responseTimeMs: seededSeries(24, 120, 60).map((v, i) => ({ label: `${i}:00`, value: v })),
    errorRatePct: 0.4,
    uploadVolume: seededSeries(7, 30, 20).map((v, i) => ({ label: `D${i + 1}`, value: v })),
    storageUsedGb: 42,
  }), []);
}

/** MOCK: background jobs / queues. Replace with a scheduler/queue introspection API. */
export function useJobs() {
  return useMemo(() => ({
    __mock: true,
    running: [
      { id: 'job_1', name: 'maintenance:generate', startedAt: '2 min ago', status: 'running' },
    ],
    failed: [
      { id: 'job_9', name: 'mail:digest', startedAt: '1 h ago', status: 'failed', error: 'SMTP timeout' },
    ],
    scheduled: [
      { id: 'cron_1', name: 'maintenance:generate', schedule: '0 2 * * *', next: 'Tomorrow 02:00' },
      { id: 'cron_2', name: 'amc:expiry-check', schedule: '0 6 * * *', next: 'Tomorrow 06:00' },
    ],
    retryQueue: [] as { id: string; name: string; attempts: number }[],
  }), []);
}

/** MOCK: storage aggregates. Replace with a MinIO usage API. */
export function useStorageStats() {
  const { data: communities } = usePlatformCommunities();
  return useMemo(() => {
    const byCommunity: Point[] = (communities?.items ?? []).slice(0, 8).map((c, i) => ({
      label: c.name, value: 2 + ((i * 7) % 18),
    }));
    return {
      __mock: true,
      totalGb: 500, usedGb: 42,
      communityStorageGb: byCommunity.reduce((s, d) => s + d.value, 0),
      byCommunity,
      growth: MONTHS.slice(0, 6).map((label, i) => ({ label, value: 20 + i * 4 })),
    };
  }, [communities]);
}

/** MOCK: application/environment info. Replace with an /admin/system/info call. */
export function useSystemInfo() {
  return useMemo(() => ({
    __mock: true,
    version: '1.0.0',
    releaseVersion: 'v1.0.0-rc1',
    buildDate: '2026-07-23',
    environment: (import.meta.env.MODE ?? 'production').toString(),
    uptime: '7d 4h 12m',
    dockerVersion: '27.3.1',
    nodeVersion: '24.16.0',
    databaseVersion: 'PostgreSQL 16.3',
    redisVersion: 'Redis 7.4',
  }), []);
}

export interface AuditRow {
  id: string; at: string; user: string; action: string; module: string; ip: string; status: 'ok' | 'fail';
}

/** MOCK: audit log. The AuditLog table exists but has no read endpoint yet —
 *  replace with /admin/audit once it ships. */
export function useAuditLog() {
  return useMemo<AuditRow[]>(() => [
    { id: 'a1', at: '2026-07-23 22:14', user: 'admin@living.local', action: 'LOGIN_AS_COMMUNITY', module: 'Admin', ip: '10.0.0.4', status: 'ok' },
    { id: 'a2', at: '2026-07-23 21:58', user: 'admin@living.local', action: 'COMMUNITY_CREATE', module: 'Admin', ip: '10.0.0.4', status: 'ok' },
    { id: 'a3', at: '2026-07-23 21:40', user: 'assoc@arbour.com', action: 'RESIDENT_CREATE', module: 'People', ip: '10.0.0.9', status: 'ok' },
    { id: 'a4', at: '2026-07-23 20:12', user: 'unknown', action: 'LOGIN_FAILED', module: 'Auth', ip: '203.0.113.7', status: 'fail' },
    { id: 'a5', at: '2026-07-23 19:03', user: 'assoc@arbour.com', action: 'ROLE_CHANGE', module: 'RBAC', ip: '10.0.0.9', status: 'ok' },
  ], []);
}

/** Deterministic pseudo-series so charts don't flicker between renders. */
function seededSeries(n: number, base: number, amp: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(base + amp * Math.abs(Math.sin(i * 1.3))));
}
