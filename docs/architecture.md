# Living Platform — Architectural Review (Sprint 1)

This document explains **why** each foundational decision was made and **how**
it supports the future Living modules (property sales, community, facility
management, marketplace, home services, analytics). Sprint 1 ships the
substrate only — no business logic — so these decisions are the ones we will
live with for years.

---

## 1. Guiding principles

- **Clean Architecture / DDD boundaries.** Dependencies point inward.
  Controllers (presentation) are thin; use-cases live in services
  (application); Prisma models are the persistence detail (infrastructure).
  Domain rules that matter — tenant isolation, token rotation, RBAC resolution
  — live in services, never in controllers or guards' incidental logic.
- **Feature modules.** Each concern is a self-contained NestJS module
  (`auth`, `rbac`, `users`, `tenancy`, `audit`, `health`) with its own
  controller/service/DTOs. A future `tickets` module drops in the same shape
  without touching the foundation.
- **SOLID, low coupling.** Cross-cutting infrastructure (`prisma`, `redis`,
  `mail`, `tenancy`, `audit`) is exposed as `@Global()` modules so feature
  modules depend on small injectable services, not on each other.
- **Configuration over code.** Tenants, communities, roles and permissions are
  **data**. Onboarding a new community or adjusting a role is a row change, not
  a deploy — the explicit Sprint-1 requirement of "future communities without
  code changes."

---

## 2. Monorepo: pnpm workspaces + Turborepo

**Why.** The platform is a frontend + backend + shared-library system. A single
repo keeps the API contract, shared types and RBAC catalog in lockstep and lets
one PR change a permission and its UI gate together. pnpm gives strict,
content-addressed installs (no phantom dependencies); Turborepo gives task
orchestration and caching that stays fast as `apps/*` and `packages/*` grow.

**Future.** `apps/web` (React 19) and `packages/shared` (RBAC catalog, DTO
types, zod schemas) slot into the existing `pnpm-workspace.yaml` with no
restructuring. Turborepo's `dependsOn` graph already expresses "build shared
before app."

---

## 3. Tenancy model

```
Tenant 1───N Community          Tenant   = the customer/org (an association, a
Tenant 1───N User                          management company)
User   N───N Role  (UserRole,   Community = a building/association under a tenant
            scoped to Community) User     = a person; platform users have no tenant
Role   N───N Permission
```

**Decisions & why.**

- **`User.tenantId` is nullable.** Platform Admins operate *above* tenants;
  everyone else is bound to one. This models the real hierarchy instead of
  forcing a fake "system tenant."
- **Users attach to communities via `UserRole`, not a direct FK.** One person
  can be a Resident of community A and a Facility Manager of community B within
  the same tenant. Membership *is* a scoped role assignment — that is exactly
  what `UserRole(userId, roleId, communityId?)` encodes.
- **Row-level scoping is enforced in services** (`UsersService.tenantScope()`)
  using the request-scoped `TenantContextService`, which derives tenant/identity
  from the authenticated principal. A Platform Admin is explicitly allowed to
  cross tenants; everyone else is confined.

**How it supports the future.** Every business entity will carry `communityId`
(and thus, transitively, a tenant). The `TenantContextService` is the single
choke point future modules use to scope every query — the pattern is
established now with `UsersService` as the reference implementation.

**Deliberate ceiling.** Isolation is application-enforced, not database-enforced.
Postgres Row-Level Security is the defense-in-depth upgrade if/when a compliance
requirement demands the database refuse cross-tenant reads even on a code bug.
The schema (every scoped row has a tenant/community column) is already shaped
for it.

---

## 4. RBAC — configurable, not hardcoded

**Design.** Permissions are canonical `resource:action` **rows**. Roles are
rows. `RolePermission` and `UserRole` are join rows. Guards never contain
`if (role === 'ADMIN')` logic — they check *permissions*.

- **`rbac.constants.ts`** is the seed source of truth and the *typed* reference
  (`PERMISSIONS.USER_READ`) so `@RequirePermissions(...)` is checked at compile
  time — you cannot ship a typo'd permission string.
- **`RbacService.resolveAuthorization()`** is the one place that flattens a
  user's role assignments into an effective permission set. This runs at
  login/refresh and the result is embedded in the access token.
- **Roles carry a `scope`** (`PLATFORM` / `TENANT` / `COMMUNITY`) that makes the
  meaning of a null `communityId` on an assignment explicit and drives future
  scope-aware checks.

**Why embed permissions in the token.** Guards then authorize with **zero
database round-trips** on the hot path — critical at "thousands of communities"
scale. The trade-off (a permission change lands on next refresh) is documented
and has a clear upgrade path (Redis-backed live resolution) if instant
revocation becomes a requirement.

**How it supports the future.** A new module adds its permissions to the catalog
and reseeds; tenant admins compose custom roles from the catalog (the `Role`
table already supports `tenantId`-scoped custom roles). No guard code changes.

---

## 5. Authentication & token security

- **Argon2id** for password hashing (memory-hard, current best practice) — not
  bcrypt.
- **Access token:** short-lived JWT (15m) carrying the flattened
  roles/permissions. Stateless, DB-free verification.
- **Refresh token:** opaque `"<rowId>.<secret>"` (selector/verifier). Only the
  **argon2 hash** of the secret is stored; the row id is the O(1) selector. This
  avoids both storing usable tokens and scanning a hash column.
- **Rotation with reuse detection:** every refresh revokes the old row and mints
  a new one in the same **family**. Presenting an already-rotated token revokes
  the **entire family** — the standard defense against refresh-token theft.
- **Password reset & email verification** use the same single-use hashed-token
  pattern; a password reset revokes all sessions.
- **Anti-enumeration:** login runs a constant-ish argon2 verify whether or not
  the account exists; forgot-password and resend-verification always return a
  generic message.

**Why.** These are the parts that are expensive to retrofit and dangerous to get
wrong. Building them correctly in the foundation means no business module ever
re-implements auth.

---

## 6. API cross-cutting concerns

Wired once, globally, in `app.module.ts`:

- **Guard chain (in order):** `ThrottlerGuard` → `JwtAuthGuard` →
  `PermissionsGuard` → `RolesGuard`. Rate-limit first (cheapest rejection),
  authenticate, then authorize. `@Public()` opts routes out of auth.
- **`ValidationPipe`** with `whitelist` + `forbidNonWhitelisted` + `transform` —
  every DTO is validated and stripped of unknown fields at the boundary.
- **`AllExceptionsFilter`** — one consistent error shape; maps known Prisma
  errors (P2002→409, P2025→404, P2003→400); never leaks stack traces or SQL.
- **`TransformInterceptor`** — consistent `{ success, data }` success envelope.
- **`AuditInterceptor`** — records every *mutating* request to the audit trail
  automatically; new modules are covered with no per-handler wiring.
- **URI versioning** (`/api/v1`) — a future breaking change ships as `/api/v2`
  alongside v1.
- **Swagger** at `/api/docs`, **Helmet** security headers, **CORS** allow-list
  from config, **pino** structured logging with secret redaction.

---

## 7. Auditing

`AuditLog` is an **append-only** table. Actor/tenant/community are stored as
plain ids (not FKs) so the log survives deletion of referenced rows and stays
cheap to write on the hot path. Writes are **best-effort** — an audit failure is
logged, never allowed to break the request it describes. The `AuditInterceptor`
covers HTTP mutations globally; `AuditService.record()` is injectable for
domain-specific events future modules will emit.

---

## 8. Data model: audit & soft-delete base

Core entities (`Tenant`, `Community`, `User`) carry `createdAt`, `updatedAt`,
`deletedAt`, `createdById`, `updatedById`. Soft delete is filtered per-query
today (`deletedAt: null`). This satisfies the Sprint-1 requirement that "every
future entity supports created/updated by, timestamps, soft delete, audit
trail" — the pattern and columns are established for modules to copy.

**Ceiling.** A Prisma client extension can globalize the `deletedAt` filter and
auto-stamp `createdById/updatedById` from `TenantContextService` once the number
of soft-deletable models makes per-query handling error-prone.

---

## 9. Observability

- **Liveness** (`/api/v1/health`) — cheap process check for orchestrators.
- **Readiness** (`/api/v1/health/ready`) — Terminus checks Postgres, Redis, and
  heap before traffic is routed.
- **Metrics** (`/api/v1/metrics`) — Prometheus exposition format (process
  metrics today; the endpoint contract is stable for a prom-client /
  OpenTelemetry upgrade).
- **Structured logging** via pino with request logging and secret redaction.

Redis is wired now (lazy connection, health-checked) so caching, Redis-backed
rate-limiting and token denylists are a small step away when a module needs them.

---

## 10. What was intentionally NOT built

Per the Sprint-1 brief: no tickets, vendors, residents-as-domain, complaints,
marketplace, assets, work orders, property or services modules. No speculative
abstractions (no generic repository layer, no CQRS/event bus, no
one-implementation interfaces). The foundation is complete and boring on
purpose — complexity is added when a real module demands it, not before.

---

## 11. Verification performed

- `prisma validate` — schema valid.
- `prisma generate` — client generates.
- `nest build` — full TypeScript compile, no errors.
- `jest` — unit tests pass (duration parser).
- **DI graph resolution** — the entire `AppModule` provider graph instantiates
  (every guard, interceptor, strategy, service and their dependencies resolve),
  verified without a database connection.

Runtime boot against a live database requires `docker compose up -d` +
`db:migrate` + `db:seed` (Docker was not available in the build environment, so
runtime boot is a documented manual step rather than an automated one here).

---

## 12. Next pass (frontend)

- `apps/web`: React 19 + Vite + React Router + TanStack Query + Zustand + RHF +
  Zod, with the four layouts (public, auth, dashboard, blank) and placeholder
  routing.
- `packages/ui`: the Living Design System tokens + components wrapped as a
  consumable library (the `.jsx` components import directly; the token CSS
  becomes the global stylesheet).
- `packages/shared`: extract the RBAC catalog + DTO/zod contracts so the web app
  gates UI on the same permission strings the API enforces.
