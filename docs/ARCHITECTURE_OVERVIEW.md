# Architecture Overview — Living v1.0

A multi-tenant PropTech platform: one NestJS API, three React frontends, shared
TypeScript packages, in a pnpm + Turborepo monorepo.

## Topology

```
                         Cloudflare (TLS, WAF, HSTS)
                                   │
                          ┌────────┴────────┐  edge nginx (host-routing)
        admin.* ──▶ portal │ app.* ──▶ resident │ gate.* ──▶ workforce
                          └────────┬────────┘
                        api.* ──▶  API (NestJS)
                                   │
                 ┌─────────────────┼──────────────────┐
             Postgres 16        Redis 7            MinIO (S3)
          (data + audit)   (refresh sessions)   (uploads, when s3)
```

## Monorepo

```
apps/       api (NestJS)  ·  portal (admin SPA)  ·  resident (PWA)  ·  workforce (PWA)
packages/   types  ·  living-sdk  ·  ui  ·  hooks  ·  design-system  ·  utils  ·  config
```

Dependency direction is strictly downward: apps → sdk/ui/hooks → types/utils.
No package imports an app; no circular edges. Frontends never call `fetch` —
only the typed `living-sdk`. The SDK is the single API contract; `@living/types`
mirrors the Prisma enums/entities.

## Backend engines (independent bounded contexts)

Platform · Community · People · **Tickets · Service Requests · Work Orders**
(operational execution) · **Assets** (register) · **Preventive Maintenance**
(schedules → generates Work Orders) · **AMC** (contracts, coverage, SLA) ·
**Community Operations** (visitors, amenities, bookings, documents, announcements).

Cross-engine references are **loose scalar ids, no FKs** (e.g. `WorkOrder.assetId`,
`WorkOrder.originId`, `AMCCoverage`→asset), so engines stay independent and
swappable. Execution lives only in the Work Order engine; PM/AMC never execute.

## Cross-cutting foundations (reused everywhere)

- **Tenancy** — `CommunityAccessService` choke point; `tenantId`+`communityId`
  denormalised onto every row for cheap, safe scoping.
- **RBAC** — configurable permissions in the DB, embedded in the JWT; guard-based.
- **Audit** — global interceptor writes every mutation to `audit_logs`.
- **Domain events** — `DomainEventsService` (EventEmitter2 today, outbox-ready);
  every engine emits typed events (a notifications consumer can attach later).
- **Storage** — provider-agnostic `StorageService` (signed-URL flow; `local`
  stub now, `s3`/MinIO next) — no engine touches bytes directly.
- **Schedulers** — in-process `@nestjs/schedule` crons (PM/AMC/announcements),
  idempotent via compare-and-swap.

## Data model

34→ tables across 10 migrations (`init` → `sprint10_community_operations`), all
additive and ordered. Every table: soft-delete (`deletedAt`) + audit columns,
appropriate indexes (tenant/community/status/foreign keys/date ranges), unique
constraints (codes, numbers), and FK cascade rules. Money is `Decimal`; sequences
(`SERIAL`) back display numbers (TKT-/SRQ-/WO-…).

## Request lifecycle

`Throttler → JwtAuthGuard → PermissionsGuard → RolesGuard → ValidationPipe →
controller → service (CommunityAccessService.assert + Prisma) → TransformInterceptor
(envelope) + AuditInterceptor`. Errors flow through `AllExceptionsFilter` into a
consistent error body.

For deeper per-engine rationale see `docs/architecture-sprint2.md …
architecture-sprint11.md` and the frontend `docs/frontend-*.md`.

## Money & messaging (Sprint 11)

```
modules/billing    rate cards → invoices → collection dashboards → resident dues
modules/payments   community Razorpay rails → checkout → webhooks → refunds
                   (depends on billing; never the reverse)

DomainEvent → NotificationRouterService → per-community preference
                                        → NotificationDispatcher → email | whatsapp
```

The **only** payment implementation is `modules/payments`; the **only**
notification engine is `modules/notifications`. WhatsApp via OpenWA is one extra
provider behind the existing `WhatsAppProvider` interface, not a second
messaging system. Gateway secrets are AES-256-GCM encrypted by the shared
`SecretCipher` (`common/crypto`) and never leave the server.

See [`payments.md`](payments.md), [`whatsapp.md`](whatsapp.md),
[`authentication.md`](authentication.md).

## Configuration & merchandising (Sprint 12)

```
CommunitySettings ── module toggles ──→ ModuleEnabledGuard (API)
                                    └─→ useCommunityFeatures (portal + resident)

ServicePackage ──→ Service (existing catalog)
       │      purchase → Payment (SERVICE rail) ── payment.succeeded ──→ activate
       └──── redeem ──→ ServiceRequest (existing engine)
```

Optional modules (maintenance billing, service packages) are **per-community
configuration**, answered in one place by `SettingsService.features()` and
enforced by a class-level guard rather than per-call-site checks. Service
Packages add no engine: they reference catalog services, collect through the
existing Payment Engine, and deliver through the existing Service Request
Engine. New tickets and service requests are routed to the least-loaded matching
vendor, best-effort, never blocking creation.

See [`community-settings.md`](community-settings.md),
[`service-packages.md`](service-packages.md), [`dashboards.md`](dashboards.md).
