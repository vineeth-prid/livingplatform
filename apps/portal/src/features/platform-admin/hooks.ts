import { useQuery } from '@tanstack/react-query';

import { living } from '../../lib/living';
import type { Point } from './charts';

/**
 * Platform Admin data layer — all live DB reads via /admin/stats/* and
 * /health/ready. Metrics with no historical store yet (performance/occupancy
 * timeseries) simply come back empty and fill in once data exists; nothing is
 * mocked. Polls on an interval so the dashboard stays current.
 */

const REFRESH = 60_000;

// ── Executive overview ────────────────────────────────────────────────────────

export interface Overview {
  communities: {
    total: number; active: number; suspended: number; archived: number;
    newThisMonth: number; newToday: number;
    byState: Point[]; byCity: Point[]; byType: Point[]; growthTrend: Point[];
  };
  users: {
    total: number; admins: number; owners: number; tenants: number; residents: number;
    active: number; mau: number; dau: number; newToday: number; newThisMonth: number;
    growth: Point[]; ownerVsTenant: Point[];
  };
  units: {
    total: number; occupied: number; occupancyPct: number;
    avgPerCommunity: number; avgResidentsPerUnit: number;
  };
}

export function useOverview() {
  return useQuery({
    queryKey: ['platform', 'overview'],
    queryFn: () => living.platform.statsOverview<Overview>(),
    refetchInterval: REFRESH,
  });
}

// ── Platform health (/health/ready) ──────────────────────────────────────────

export interface HealthStatus { name: string; ok: boolean }

interface ReadinessResponse {
  status?: string;
  details?: Record<string, { status?: string }>;
}

export function usePlatformHealth() {
  return useQuery({
    queryKey: ['platform', 'health'],
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
      return {
        overall: res.status === 'ok',
        deps: [
          pick('database', 'PostgreSQL'),
          pick('redis', 'Redis'),
          pick('storage', 'MinIO'),
          pick('memory_heap', 'Memory'),
        ],
      };
    },
    refetchInterval: 30_000,
  });
}

// ── System info ───────────────────────────────────────────────────────────────

export interface SystemInfo {
  app: {
    version: string; releaseVersion: string; buildDate: string | null;
    environment: string; uptime: string; nodeVersion: string; storageDriver: string;
  };
  storage: { usedMb: number; communityStorageMb: number; byCommunity: Point[] };
  jobs: {
    scheduled: { name: string; next: string | null }[];
    running: unknown[]; failed: unknown[]; retryQueue: unknown[]; pending: number;
  };
  versions: { database: string | null; redis: string | null };
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ['platform', 'system'],
    queryFn: () => living.platform.systemInfo<SystemInfo>(),
    refetchInterval: REFRESH,
  });
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export interface AuditRow {
  id: string; createdAt: string; actorEmail: string | null;
  action: string; resource: string; ipAddress: string | null; statusCode: number | null;
}

export function useAuditLog(params: { search?: string; resource?: string; page?: number }) {
  return useQuery({
    queryKey: ['platform', 'audit', params],
    queryFn: () => living.platform.auditLog<AuditRow>({ limit: 25, ...params }),
    refetchInterval: REFRESH,
  });
}

export function useAuditModules() {
  return useQuery({
    queryKey: ['platform', 'audit', 'modules'],
    queryFn: () => living.platform.auditModules(),
    staleTime: 5 * 60_000,
  });
}

export interface AuditSummary {
  windowHours: number;
  logins: number; failedLogins: number; passwordResets: number;
  roleChanges: number; permissionChanges: number; communitiesCreated: number; loginAs: number;
  totalEvents: number; errorRatePct: number;
}

export function useAuditSummary() {
  return useQuery({
    queryKey: ['platform', 'audit', 'summary'],
    queryFn: () => living.platform.auditSummary<AuditSummary>(),
    refetchInterval: REFRESH,
  });
}
