# Living Platform

> **Life Happens Here.**
> The enterprise foundation for Living — a premium, multi-tenant PropTech ecosystem.

This is **Sprint 1: the platform foundation**. It intentionally contains **no
business modules** (no tickets, vendors, residents-as-domain, marketplace,
assets, …). What it delivers is the production-grade substrate every future
Living module builds on: multi-tenancy, configurable RBAC, authentication,
auditing, observability, and the design-system integration path.

---

## What's in the box

| Layer | Status | Notes |
| --- | --- | --- |
| Monorepo (pnpm + Turborepo) | ✅ | `apps/*`, `packages/*` workspaces |
| Backend API (NestJS) | ✅ | `apps/api` — auth, RBAC, tenancy, audit, health |
| **Sprint 1** — platform foundation | ✅ | Auth, configurable RBAC, multi-tenancy, audit, observability |
| **Sprint 2** — Community Foundation | ✅ | Community, property hierarchy, units, amenities, settings, documents, profile, events, storage, search |
| **Sprint 3** — People Foundation | ✅ | Residents, vendors, staff, resident↔unit mapping, user linking |
| **Sprint 4** — Ticket Engine | ✅ | Generic tickets, categories, assignment (staff XOR vendor), status workflow, comments, attachments, timeline, dashboard |
| **Sprint 5** — Service Request Engine | ✅ | Service catalog, requests, scheduling, assignment, feedback, optional ticket link |
| **Sprint 6** — Work Order Engine | ✅ | Generic execution, loose origin link, assignment, progress updates, verify-before-close, attachments, timeline |
| **Sprint 7** — Asset Foundation | ✅ | Independent Asset Engine: categories (self-nesting), assets, documents, photos, immutable history; referenced by work orders & service requests (no ownership) |
| **Sprint 8** — Preventive Maintenance Engine | ✅ | Automation layer: recurring maintenance plans, checklists, immutable runs; a per-minute scheduler auto-generates Work Orders through the existing engine |
| **Sprint 9** — AMC Management Engine | ✅ | Contractual layer: maintenance contracts, asset coverage, SLA rules, renewal/expiry, immutable history; a daily sweep expires & flags renewals |
| **Sprint 10** — Community Operations | ✅ | Resident-facing layer: visitor management, amenity bookings, announcements (reusing the Sprint 2 amenity & document registers) |
| Prisma schema + migrations + seed | ✅ | 49 tables; 9 incremental migrations through `sprint10_community_operations` |
| Docker Compose (Postgres, Redis, Mailpit) | ✅ | Local infra |
| **Frontend FS0** — Product Experience Foundation | ✅ | Monorepo (portal + resident + workforce), Living SDK, component library, motion, app shell, auth + permission framework, theme system |
| **Frontend FS1** — Operations Dashboard | ✅ | Command-center dashboard (KPIs, attention, activity, health, my work) |
| **Frontend FS2** — Community & People Management | ✅ | Master data: community, units, residents, staff, vendors — list + detail + create/edit/archive on a shared scaffold |
| **Frontend FS3** — Ticket Experience | ✅ | Flagship module: table + kanban, detail, create/edit, assignment, comments, timeline, attachments, workflow-aware status |
| **Frontend FS4** — Operations Execution | ✅ | Service Requests + Work Orders on one shared Operations framework (workflow, assignment, timeline, kanban, progress, verification) |
| **Frontend FS5** — Resident Experience (PWA) | ✅ | Consumer-grade installable PWA: bottom nav, home, services, requests, community, profile |
| **Frontend FS6** — Workforce Experience (PWA) | ✅ | Field-execution PWA for staff & vendors: today, job queue, job detail with progress/photos/timeline, workflow-aware execution actions, offline-ready |
| **Frontend FS7** — Asset Management Experience | ✅ | Enterprise asset register (table + card), multi-section create, split-layout detail with photos/documents/history/events tabs |
| **Frontend FS8** — Preventive Maintenance & AMC | ✅ | PM plan + AMC contract workspaces (register/create/detail with tabs, checklists, runs, coverage, SLA, renewals); asset-detail relationships now live |
| **Frontend FS9** — Community Operations | ✅ | Across all 3 apps: portal admin (visitors/amenities/bookings/documents/announcements), resident PWA (invite/book/read live widgets), workforce PWA security gate |

The `Living Design System/` folder is the UI source of truth (tokens,
components, brand). It is wired into the frontend in the next pass.

**Architecture reviews:** [`docs/architecture.md`](docs/architecture.md)
(Sprint 1), [`docs/architecture-sprint2.md`](docs/architecture-sprint2.md)
(Community Foundation), [`docs/architecture-sprint3.md`](docs/architecture-sprint3.md) (People Foundation),
[`docs/architecture-sprint4.md`](docs/architecture-sprint4.md) (Ticket Engine),
[`docs/architecture-sprint5.md`](docs/architecture-sprint5.md) (Service Request Engine),
[`docs/architecture-sprint6.md`](docs/architecture-sprint6.md) (Work Order Engine),
[`docs/architecture-sprint7.md`](docs/architecture-sprint7.md) (Asset Foundation),
[`docs/architecture-sprint8.md`](docs/architecture-sprint8.md) (Preventive Maintenance Engine),
[`docs/architecture-sprint9.md`](docs/architecture-sprint9.md) (AMC Management Engine),
and [`docs/architecture-sprint10.md`](docs/architecture-sprint10.md) (Community Operations).

**Frontend:** [`docs/frontend-architecture.md`](docs/frontend-architecture.md)
(Product Experience Foundation),
[`docs/frontend-developer-guide.md`](docs/frontend-developer-guide.md) (how to build on it),
[`docs/frontend-dashboard.md`](docs/frontend-dashboard.md) (Operations Dashboard),
[`docs/frontend-master-data.md`](docs/frontend-master-data.md) (Community & People Management),
[`docs/frontend-tickets.md`](docs/frontend-tickets.md) (Ticket Experience),
[`docs/frontend-operations.md`](docs/frontend-operations.md) (Service Requests & Work Orders),
[`docs/frontend-resident.md`](docs/frontend-resident.md) (Resident Experience PWA),
[`docs/frontend-workforce.md`](docs/frontend-workforce.md) (Workforce Experience PWA),
[`docs/frontend-assets.md`](docs/frontend-assets.md) (Asset Management Experience),
[`docs/frontend-maintenance-amc.md`](docs/frontend-maintenance-amc.md) (Preventive Maintenance & AMC),
and [`docs/frontend-community-ops.md`](docs/frontend-community-ops.md) (Community Operations — portal, resident & workforce).

---

## Prerequisites

- **Node.js ≥ 20.11** (`.nvmrc` pins 20.11.0)
- **pnpm 9** — via Corepack (bundled with Node): `corepack enable`
- **Docker** — for local Postgres/Redis/Mailpit

> On Windows, if `corepack enable` can't write shims (permissions), invoke pnpm
> as `corepack pnpm@9.15.0 <args>`, or run an elevated `corepack enable` once.

---

## Quick start

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Start local infrastructure (Postgres, Redis, Mailpit)
cp .env.example .env
pnpm infra:up            # docker compose up -d

# 3. Configure the API
cp apps/api/.env.example apps/api/.env
#   → set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET to long random values

# 4. Create the schema and seed roles + demo data
pnpm --filter @living/api db:migrate     # first run: creates the migration
pnpm --filter @living/api db:seed

# 5. Run the API
pnpm --filter @living/api dev

# 6. Run the web portal (in another terminal)
cp apps/portal/.env.example apps/portal/.env
pnpm --filter @living/portal dev
```

- API: <http://localhost:4000/api/v1>
- Swagger docs: <http://localhost:4000/api/docs>
- Mailpit (catches verification/reset emails): <http://localhost:8025>
- Portal (web): <http://localhost:5173> · Resident: `:5174` · Workforce: `:5175`

### Seeded sign-in (local dev)

| Role | Email | Password |
| --- | --- | --- |
| Platform Admin | `admin@living.local` | `Living!2024` |
| Association Admin | `association@living.local` | `Living!2024` |

Try it:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@living.local","password":"Living!2024"}'
```

---

## Monorepo layout

```
living-platform/
├─ apps/
│  └─ api/                 # NestJS backend (this sprint)
│     ├─ prisma/           # schema + seed
│     └─ src/
│        ├─ common/        # decorators, guards, filters, interceptors, dto, utils
│        ├─ config/        # typed, validated configuration
│        └─ modules/       # auth, rbac, users, tenancy, health, audit, prisma, redis, mail
├─ packages/               # shared libs (frontend pass)
├─ Living Design System/   # UI source of truth (tokens, components, brand)
├─ docs/                   # architecture.md — decisions & rationale
├─ docker-compose.yml      # Postgres, Redis, Mailpit, (pgAdmin, api)
├─ turbo.json              # task orchestration
└─ pnpm-workspace.yaml
```

---

## Common commands

```bash
pnpm dev                 # run all apps in dev (turbo)
pnpm build               # build everything
pnpm lint                # lint everything
pnpm test                # test everything
pnpm typecheck           # type-check everything
pnpm infra:up / :down    # start / stop docker infra

# API-scoped
pnpm --filter @living/api dev
pnpm --filter @living/api db:migrate
pnpm --filter @living/api db:seed
pnpm --filter @living/api db:studio      # Prisma Studio
```

---

## Architecture

See **[docs/architecture.md](docs/architecture.md)** for the full architectural
review: why each decision was made and how it supports future phases (Clean
Architecture, DDD boundaries, the tenancy model, the RBAC design, token
security, and the observability story).
