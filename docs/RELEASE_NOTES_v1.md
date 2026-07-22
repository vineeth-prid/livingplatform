# Living v1.0 — Release Notes (Release Candidate)

**Life Happens Here.** The first production release of the Living platform — a
multi-tenant PropTech ecosystem spanning an admin portal, a resident PWA, and a
workforce/security PWA on one NestJS backend.

## What's in v1.0

**Backend engines (10):** Platform foundation (multi-tenancy, configurable RBAC,
Argon2 auth with rotating refresh + reuse detection, audit, observability) ·
Community foundation (hierarchy, units, amenities, documents, settings) · People
(residents, vendors, staff) · Ticket engine · Service Request engine · Work Order
engine (execution, verify-before-close) · Asset foundation (register, documents,
photos, immutable history) · Preventive Maintenance (recurring plans → auto-
generated work orders) · AMC management (contracts, coverage, SLA, renewals) ·
Community Operations (visitors, amenities, bookings, documents, announcements).

**Frontends (3):** Portal (admin — every engine), Resident PWA (tickets, services,
visitors, bookings, amenities, documents, announcements), Workforce PWA (field
execution + security gate).

**Shared:** typed `living-sdk`, `@living/types`, `ui`, `hooks`, `design-system`.

## Production hardening in this RC

- Repo-wide **ESLint** (flat config) — API + 3 apps + 6 packages, **zero
  warnings/errors** via `pnpm -r lint`.
- **Type-safe** across all 11 projects (`pnpm -r typecheck` clean; strict mode).
- **Clean production builds** with route-level code-splitting and guarded chunk
  budgets.
- **Docker**: multi-stage API image + a parameterised web image (nginx static)
  + `docker-compose.production.yml` (Postgres, Redis, MinIO, API, 3 frontends,
  edge nginx) with healthchecks, restart policies, resource limits, and capped
  logging.
- **Observability**: liveness/readiness probes, metrics endpoint, structured
  redacted JSON logs, request ids.
- **Docs**: DEPLOYMENT, OPERATIONS, BACKUP, SECURITY, ENVIRONMENT, ARCHITECTURE.

## Known limitations (tracked)

- **Object storage is a metadata-only stub** (`STORAGE_DRIVER=local`). Uploads
  register metadata; bytes aren't stored until the `S3StorageProvider` ships
  (MinIO is already in the stack; flip to `STORAGE_DRIVER=s3`).
- **Resident self-service create (visitor/booking)** needs a `residentId` the
  RESIDENT role can't currently look up (no `/me/resident` endpoint / self-read
  grant). Resolved best-effort in the PWA; read flows are fully functional.
  A `/me/resident` endpoint is planned for v1.0.1.
- **Notifications**: engines emit domain events; no delivery channel yet
  (no email/push/SMS by design) — a consumer can attach without engine changes.
- **Dependency vulnerabilities**: backend framework transitive deps flagged by
  audit — none reachable in Living's usage; a dependency refresh is planned for
  v1.0.1 (see SECURITY.md).

## Upgrade / migration

Fresh install. Migrations apply in order on API start (`prisma migrate deploy`).
Seed roles/permissions + demo data once (`db:seed`).

## Credits

Built across 10 backend sprints and 10 frontend passes, plus this release-
hardening pass. 🤖 Generated with [Claude Code](https://claude.com/claude-code).
