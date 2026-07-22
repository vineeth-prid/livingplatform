# Living Platform — Architectural Review (Sprint 6: Work Order Engine)

Sprint 6 adds a third independent operational engine: **Work Orders** —
execution. A Work Order is *work assigned to a staff member or vendor*. It is
neither a complaint (Ticket) nor a request (Service Request); it can **originate
from any of them** — or from future modules (Preventive Maintenance, AMC, Asset
Maintenance, Inspections, Manual Operations) — via a loose link. The Ticket and
Service Request engines were **not modified** (the incremental migration shows
no ALTER on their tables).

---

## 1. Loose coupling to origins (the defining decision)

A Work Order records where it came from as a `{ originType, originId }` pair —
`originType` is an enum (`MANUAL` / `TICKET` / `SERVICE_REQUEST`, extensible),
`originId` is a **plain string with NO foreign key**. The engine never validates
or joins back to a Ticket or Service Request row. Consequences:

- Any engine (present or future) creates a Work Order by passing its own id as
  `originId` — no change to this engine, no dependency edge toward it.
- The Work Order Engine depends on **nothing** above the Community Foundation.
  (It doesn't even import the Ticket or Service Request modules.)

This is the same "reference by id, not FK" principle used for actor ids since
the Ticket Engine, applied here to the origin link — the cleanest possible
boundary for a reusable execution engine.

---

## 2. Reuses proven patterns, not code

Structurally the engine mirrors the Ticket Engine (four tables: `WorkOrder`,
`WorkOrderUpdate`, `WorkOrderAttachment`, `WorkOrderTimeline`) and reuses its
conventions rather than its code:

- **SERIAL** `number` → display `WO-000001` (derived, not stored).
- **Staff-XOR-vendor** assignment with identical validation (staff in community,
  vendor covers community + same tenant), `reassignedCount`, auto `DRAFT →
  ASSIGNED`.
- A dedicated **status service** owning all transitions.
- **Structured timeline** (`{ type, actor, reference, metadata }`, never text),
  written atomically with the CREATED event.
- **Plain actor ids** validated in services; tenant isolation via
  `CommunityAccessService`.
- Attachments through the Sprint 2 **StorageService** (metadata + signed URL).

`unitId` is **optional** here (unlike Tickets): some execution is community/
common-area wide, not unit-specific.

---

## 3. Status workflow + verify-before-close

`WorkOrderStatusService` owns:

```
DRAFT → ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED → VERIFIED → CLOSED
      (+ ON_HOLD detours, CANCELLED exits, redo/reopen back to IN_PROGRESS)
```

The business rule "**completed work must be verified before closure**" is
encoded structurally: `CLOSED` is reachable **only from `VERIFIED`**, never from
`COMPLETED`. Verified in a unit test. Fine-grained permission gates layer on
top: `IN_PROGRESS` needs `workorder:start`, `COMPLETED` needs
`workorder:complete`, `CLOSED` needs `workorder:close`. `startedDate` /
`completedDate` stamp automatically.

**Verification** is a dedicated action (`POST …/verify`), gated by
`workorder:verify` — granted only to **Facility Manager** and **Association
Admin** (not vendors/staff), which is exactly the "who can verify" rule, enforced
by the permission catalog rather than hardcoded role checks. It records
`verifiedBy` / `verifiedDate` / `verificationRemarks` and transitions
`COMPLETED → VERIFIED` (rejected from the generic status endpoint to force the
remarks-carrying path).

"**Closed work becomes read-only**" — terminal work orders reject updates.

---

## 4. Progress updates

`WorkOrderUpdate` rows carry `comment`, optional `progressPercent` (0–100), and
an `isInternal` flag (internal updates hidden from callers without
`workorder:update`, i.e. residents). Each records a `PROGRESS_UPDATED` timeline
entry and publishes `ProgressUpdated`.

---

## 5. RBAC & events

New permissions `workorder:create/view/update/assign/start/complete/verify/close`,
granted to Association Admin & Facility Manager (all — both can verify/close),
Vendor (view/update/start/complete — execute, not verify/close), Resident (none —
execution is internal). Data only, no guard changes.

Events (no delivery): `WorkOrderCreated`, `WorkOrderAssigned`, `WorkStarted`,
`ProgressUpdated`, `WorkCompleted`, `WorkVerified`, `WorkClosed` — added to the
typed catalog for a future notification module.

---

## 6. API surface (all under `/api/v1`)

```
POST   communities/:cid/work-orders          create        workorder:create
GET    communities/:cid/work-orders           list/filter   workorder:view
GET    work-orders/:id                          details       workorder:view
PATCH  work-orders/:id                           update        workorder:update
PATCH  work-orders/:id/status                    status        workorder:update (+start/complete/close)
PUT    work-orders/:id/assignment                assign        workorder:assign
POST   work-orders/:id/verify                     verify        workorder:verify
DELETE work-orders/:id                             soft delete   workorder:close
GET    work-orders/:id/timeline                   timeline      workorder:view
GET/POST work-orders/:id/updates                  progress      workorder:view / workorder:update
GET    work-orders/:id/attachments                list          workorder:view
POST   work-orders/:id/attachments/upload-url     signed url    workorder:update
POST   work-orders/:id/attachments                register      workorder:update
```

---

## 7. Verification performed

- `prisma validate` + `generate` — valid (34 tables).
- **Incremental migration** `prisma/migrations/20260721020000_sprint6_work_order_engine/`
  (diffed from the Sprint 5 snapshot: 4 tables + 3 enums, `number` as SERIAL,
  **no ALTER on tickets / service_requests** — proving prior engines untouched).
- `nest build`, `eslint --max-warnings 0` — clean.
- `jest` — **48 tests pass** (+7 work-order transitions incl. verify-before-close
  & number format).
- **DI-graph resolution** — full AppModule (Sprints 1–6) resolves without a DB;
  the Work Order module imports no other engine.

Runtime boot still requires `docker compose up -d` + `db:migrate deploy` +
`db:seed` (Docker unavailable in this build environment).

---

## 8. What was intentionally NOT built

No merge with Tickets or Service Requests, no FK to either, no
cross-engine "create work order from ticket" endpoints on the other engines
(callers pass origin), no scheduling/calendar, no notification delivery (events
only), no frontend (contracts only). The engine executes work and nothing else —
a reusable execution core any future module can drive by creating a Work Order
with its own origin id.
