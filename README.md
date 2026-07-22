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
| Prisma schema + migrations + seed | ✅ | 34 tables; 5 incremental migrations through `sprint6_work_order_engine` |
| Docker Compose (Postgres, Redis, Mailpit) | ✅ | Local infra |
| **Frontend FS0** — Product Experience Foundation | ✅ | Monorepo (portal + resident + workforce), Living SDK, component library, motion, app shell, auth + permission framework, theme system |
| **Frontend FS1** — Operations Dashboard | ✅ | Command-center dashboard (KPIs, attention, activity, health, my work) |
| **Frontend FS2** — Community & People Management | ✅ | Master data: community, units, residents, staff, vendors — list + detail + create/edit/archive on a shared scaffold |
| **Frontend FS3** — Ticket Experience | ✅ | Flagship module: table + kanban, detail, create/edit, assignment, comments, timeline, attachments, workflow-aware status |
| **Frontend FS4** — Operations Execution | ✅ | Service Requests + Work Orders on one shared Operations framework (workflow, assignment, timeline, kanban, progress, verification) |
| **Frontend FS5** — Resident Experience (PWA) | ✅ | Consumer-grade installable PWA: bottom nav, home, services, requests, community, profile |

The `Living Design System/` folder is the UI source of truth (tokens,
components, brand). It is wired into the frontend in the next pass.

**Architecture reviews:** [`docs/architecture.md`](docs/architecture.md)
(Sprint 1), [`docs/architecture-sprint2.md`](docs/architecture-sprint2.md)
(Community Foundation), [`docs/architecture-sprint3.md`](docs/architecture-sprint3.md) (People Foundation),
[`docs/architecture-sprint4.md`](docs/architecture-sprint4.md) (Ticket Engine),
[`docs/architecture-sprint5.md`](docs/architecture-sprint5.md) (Service Request Engine),
and [`docs/architecture-sprint6.md`](docs/architecture-sprint6.md) (Work Order Engine).

**Frontend:** [`docs/frontend-architecture.md`](docs/frontend-architecture.md)
(Product Experience Foundation),
[`docs/frontend-developer-guide.md`](docs/frontend-developer-guide.md) (how to build on it),
[`docs/frontend-dashboard.md`](docs/frontend-dashboard.md) (Operations Dashboard),
[`docs/frontend-master-data.md`](docs/frontend-master-data.md) (Community & People Management),
[`docs/frontend-tickets.md`](docs/frontend-tickets.md) (Ticket Experience),
[`docs/frontend-operations.md`](docs/frontend-operations.md) (Service Requests & Work Orders),
and [`docs/frontend-resident.md`](docs/frontend-resident.md) (Resident Experience PWA).

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
