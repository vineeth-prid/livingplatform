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

---

# v1.2 — Configuration, Packages & Intelligence (Sprint 12)

An enhancement release. No architecture change, no new engine, no breaking API.
Every new column defaults to today's behaviour, so an existing deployment
upgrades without losing a surface.

## Community configuration

- **Maintenance billing is now per-community.** Associations that collect
  outside Living switch it off; invoice generation, maintenance payments and
  every maintenance surface disappear from the portal and the resident app.
  Existing invoices and history are kept, and payments already in flight still
  settle.
- **Service packages** can be switched off the same way.
- **Resident home banners** are configurable per community.

Portal → Community → **Settings**. Both modules default to **ON**.

## Service availability

Services are **enabled or disabled**, never deleted. An inactive service leaves
the resident app and cannot be requested, while its history and any in-flight
work are untouched. Portal → Catalog → **Services**.

## Resident home, redesigned

Rotating hero (live announcements + configured slides), quick actions moved to
the top, active requests only, upcoming booking shown only when there is one.
Recent activity and the visitors widget are gone; visitors now sit inside **My
requests** alongside complaints and service requests. The app opens in Light.

## Automatic vendor assignment

New tickets and service requests route to the least-loaded ACTIVE vendor that
covers the community and matches the category. No match leaves the work
unassigned for a human. **Assignment never blocks creation.**

## Service Packages

Bundles of existing catalog services sold at a package price — with property-type
targeting, validity windows, duplicate-as-draft, and frozen savings. Buying uses
the existing Razorpay SERVICE rail; redeeming creates an ordinary Service
Request. No package engine, no second booking path.

Portal → Catalog → **Packages**. Residents: **Services** (packages first) and
**Profile → My packages**.

## Dashboards

- **Community**: adoption, most-booked service and package, maintenance and
  service collections, outstanding, top vendors.
- **Platform**: module adoption, popular services and packages, aggregate
  revenue and growth — with **no per-community financials**.

## Upgrade notes

| Step | |
| --- | --- |
| Migrations | `prisma migrate deploy` — `20260804000000_modules_packages_autoassign` |
| Reseed | Required: `service:catalog:*`, `package:*`, `insights:read` |
| Review | Community → Settings for any association that does not collect through Living |
| Optional | Set `basePrice` on services so packages can advertise savings |

228 backend tests, 43 frontend tests, typecheck/lint/build clean.
