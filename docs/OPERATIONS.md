# Operations Runbook — Living v1.0

`COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"`

## Health & status

| Check | Command |
| --- | --- |
| Liveness | `curl -fsS https://api.living.example/api/v1/health` |
| Readiness (DB/Redis/**storage**/heap) | `curl -fsS https://api.living.example/api/v1/health/ready` |
| Metrics | `GET /api/v1/metrics` (permission-guarded) |
| Container health | `$COMPOSE ps` (all `healthy`) |
| Logs (structured JSON, pino) | `$COMPOSE logs -f api` |

Kubernetes/orchestrator probes: **liveness** `/api/v1/health`, **readiness**
`/api/v1/health/ready`. Compose healthchecks are already defined per service.

## Logging

Structured JSON via `nestjs-pino`; auth headers/cookies are **redacted**. Health
requests are excluded from access logs. Each request carries a request id.
Retention is capped by the json-file driver (`max-size 10m`, `max-file 5`) — ship
to a log aggregator (Loki/ELK/Cloudflare Logpush) for long-term retention.

Notable log events: startup (`Living API [env] listening…`), scheduler runs
(PM generation, AMC expiry, announcement sweep — counts logged when non-zero),
audit trail (every mutation → `audit_logs` table), and domain-event emissions
(debug level).

## Scheduled jobs (in-process cron)

| Job | Cadence | Toggle |
| --- | --- | --- |
| Preventive-maintenance WO generation | every minute | `PM_SCHEDULER_ENABLED` |
| AMC expiry / renewal sweep | daily 01:00 | `AMC_EXPIRY_ENABLED` |
| Announcement publish / expire | hourly | `ANNOUNCEMENT_SWEEP_ENABLED` |

All are **idempotent** (compare-and-swap). With multiple API replicas, run the
sweeps on exactly one (disable on the others) — see [`ENVIRONMENT.md`](ENVIRONMENT.md).

## Common tasks

```bash
$COMPOSE restart api                 # restart a service
$COMPOSE exec api node node_modules/prisma/build/index.js migrate status
$COMPOSE exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB   # DB shell
$COMPOSE exec redis redis-cli info memory
$COMPOSE logs --since 15m api | grep -i error
```

## Incident playbook

- **API unhealthy / readiness failing** → check `logs api`; verify Postgres &
  Redis healthy (`$COMPOSE ps`); readiness fails if DB/Redis unreachable or heap
  > 512 MB. Restart API; if OOM, raise the api memory limit.
- **DB connection errors** → `$COMPOSE ps postgres`; check disk (`df -h`); the
  `postgres-data` volume mustn't fill the host.
- **Migrations blocking start** → `migrate status`; a failed migration halts the
  API (fail-fast). Fix forward or restore from backup ([`BACKUP.md`](BACKUP.md)).
- **Rate-limit false positives** → tune `THROTTLE_LIMIT`/`THROTTLE_TTL`; the edge
  also has a coarse `limit_req` backstop in `edge.conf`.
- **Storage (`s3`) readiness failing** → `readiness` shows the `storage` key +
  driver. Check MinIO healthy (`$COMPOSE ps minio`), credentials, and that the
  bucket exists (`mc ls living/$STORAGE_BUCKET`). The API refuses to boot if the
  store is unreachable at startup (fail-fast) — check `logs api` for
  `S3 storage unreachable or credentials invalid`. Uploads/downloads use presigned
  URLs; if links 403, verify `STORAGE_PUBLIC_URL`/bucket-read policy and clock skew.
- **Duplicate PM work orders** → shouldn't happen (CAS); if seen, ensure only one
  replica has the schedulers enabled.

## Scaling

- **API**: stateless (JWT + Redis refresh store) → scale horizontally; keep the
  schedulers on one replica. Add replicas behind the edge upstream.
- **Postgres**: vertical first; add read replicas + PgBouncer when write load
  grows. Indexes are already in place (see the Database Audit).
- **Redis**: single node is fine for the refresh store; enable persistence (AOF,
  already on) and back it up if refresh-session continuity matters.
