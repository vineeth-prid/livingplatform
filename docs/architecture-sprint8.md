# Backend Sprint 8 — Preventive Maintenance Engine

The platform's **automation layer**. A Preventive Maintenance (PM) engine that
decides *when* maintenance on an asset is due and **automatically generates Work
Orders** for it on a recurring schedule. It never executes maintenance —
execution, workflow, assignment, status and timeline all remain entirely inside
the existing Work Order Engine.

> The PM engine decides "when maintenance is due." The Work Order engine performs it.

It reuses the whole platform (Asset Engine, Work Order Engine, tenancy, storage,
events, audit, RBAC, pagination/sort/validation, `@nestjs/schedule`) and changes
**no existing engine's code**.

## Domain model

```
MaintenancePlan ──┬─ MaintenanceChecklistTemplate  (reusable checklist items)
                  └─ MaintenanceRun                (immutable generation history)
                          │
                          └─ generatedWorkOrderId → (existing) WorkOrder
```

- **MaintenancePlan** — an asset + a recurrence (frequency + interval, or a CUSTOM
  cron), a start/end window, priority, estimated duration, a verify-before-close
  flag, and the `nextRunAt` instant the scheduler watches.
- **MaintenanceChecklistTemplate** — reusable checklist items, snapshotted into
  each generated Work Order's metadata. Checklist *execution* is a future sprint.
- **MaintenanceRun** — immutable history: one row per generation attempt
  (`SCHEDULED` / `GENERATED` / `SKIPPED` / `FAILED`), with the generated work
  order id and the reason.

## The scheduler

`@nestjs/schedule` runs `MaintenanceSchedulerService` **every minute**. It queries
active, non-deleted plans with `nextRunAt <= now` (within the start/end window)
and generates a Work Order for each.

**Idempotency (no duplicate generation)** is a compare-and-swap on `nextRunAt`:
before generating, the engine advances the plan's `nextRunAt` with an
`updateMany({ where: { id, nextRunAt: <the value it read> }, … })`. Only the
worker whose CAS matches one row proceeds — so overlapping ticks (or multiple
instances) can never double-generate a slot. The next run is **rolled forward
past `now`**, so a plan whose start date was months ago produces exactly **one**
work order and lands on its next real slot, not a per-minute backlog.

The recurrence math (`maintenance.schedule.ts`) is pure and unit-tested: fixed
frequencies use calendar arithmetic (month-end clamped), CUSTOM uses `cron-parser`
(a real parser — no hand-rolled cron). `PM_SCHEDULER_ENABLED=false` disables the
tick on a given instance.

## Work Order generation — consuming the existing engine

The PM engine calls **`WorkOrderService.create()`** — it does not re-implement
execution. The generated work order carries:

- `originType = PREVENTIVE_MAINTENANCE` (a new, additive enum value), `originId =
  plan.id` (the platform's loose-coupling pattern — no FK),
- `assetId` (the loose column added in Sprint 7 — set on the generated WO without
  modifying the Work Order engine),
- community, priority, description, unit (from the asset), estimated hours (from
  the plan's minutes), due date (the scheduled instant), and a **metadata
  snapshot** of the checklist + `maintenancePlanId` + `requiresVerification`.

### Calling a request-scoped service from a singleton

`WorkOrderService` is **request-scoped** (it depends on the request-scoped
`TenantContextService`). A singleton `@Cron` scheduler cannot constructor-inject
it, so `MaintenanceGenerationService` resolves it per-generation via
`ModuleRef.resolve(WorkOrderService, contextId)` after
`registerRequestByContextId({ user })` — the idiomatic Nest way to invoke a
request-scoped provider from a scheduler/queue context. The scheduler acts as a
**platform-scoped system principal** (so it may operate across tenants); manual
generation acts as the requesting user.

## API

| Method | Route | Permission |
| --- | --- | --- |
| GET/POST | `/maintenance-plans` | `maintenance:read` / `maintenance:create` |
| GET/PATCH/DELETE | `/maintenance-plans/:id` | `maintenance:read` / `:update` / `:delete` |
| POST | `/maintenance-plans/:id/generate` | `maintenance:generate` |
| GET | `/maintenance-plans/:id/runs` | `maintenance:read` |
| GET | `/maintenance-runs/:id` | `maintenance:read` |
| POST | `/maintenance-plans/:id/checklist` | `maintenance:checklist:manage` |
| PATCH/DELETE | `/maintenance-checklists/:id` | `maintenance:checklist:manage` |

Pause/resume (the SDK's `pause()`/`resume()`) are a `PATCH { isActive }` — the
service detects the transition and emits `MaintenancePlanPaused` /
`MaintenancePlanActivated`. Filters: search, asset, category, frequency, active,
**upcoming** (`nextRunAt` future), **overdue** (active and already due). Sort
whitelist: name, asset, frequency, nextRun, lastRun, priority.

## Validation

Asset exists and belongs to the community; community ownership (via
`CommunityAccessService`); date ranges (`endDate` after `startDate`); frequency
rules (`CUSTOM` requires a cron expression); cron syntax (`cron-parser`); and
**inactive plans cannot generate** (both the scheduler's `isActive` filter and a
guard in manual generation).

## Events & audit

Domain events only (never notifications): `MaintenancePlanCreated`,
`MaintenancePlanUpdated`, `MaintenancePlanActivated`, `MaintenancePlanPaused`,
`MaintenanceRunGenerated`, `MaintenanceRunSkipped`, `MaintenanceWorkOrderCreated`
— through the shared `DomainEventsService`. API mutations are captured by the
global `AuditInterceptor`; scheduler-generated work orders are additionally
written to the audit trail explicitly (the scheduler has no HTTP request) and are
fully recorded as immutable `MaintenanceRun` rows.

## Multi-tenancy

Every plan carries `tenantId` + `communityId`; all reads/writes route through
`CommunityAccessService.assert`. Lists require a `communityId`. Generation always
uses the plan's own community — work is never generated across communities.

## SDK

`living.maintenance.{list,get,create,update,pause,resume,runs,run,generateNow,
addChecklistItem,updateChecklistItem,removeChecklistItem}`, with
`MaintenancePlan`, `MaintenanceChecklistTemplate`, `MaintenanceRun` + the two
enums in `@living/types`.

## Verification

- `prisma validate` + `generate` — clean.
- `nest build` — clean. `eslint --max-warnings 0` — clean.
- Jest — **66 tests pass** (11 new: recurrence math — every frequency, interval,
  month-end clamp, cron, roll-forward, initial run, cron validation).
- All 11 workspace projects typecheck.
- Migration `20260722010000_sprint8_preventive_maintenance` (2 enums, 3 tables,
  `PREVENTIVE_MAINTENANCE` added to `WorkOrderOriginType`). Not run against a live
  DB (no Docker on this host — consistent with Sprints 3–7). The every-minute
  scheduler is wired via `ScheduleModule.forRoot()` and gated by
  `PM_SCHEDULER_ENABLED`.
