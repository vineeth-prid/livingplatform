# Living Platform — Architectural Review (Sprint 5: Service Request Engine)

Sprint 5 adds a **separate** Service Request Engine. A Service Request is
requested **work** (a resident asks for an electrician, a cleaning, a
carpenter); a Ticket is an operational **issue**. They are kept separate but
connected: a Service Request may optionally link to a Ticket. The Ticket Engine
was **not modified** — the link is a nullable scalar, and no Ticket table or
code changed.

---

## 1. Separate engine, not merged

The brief is emphatic: do not merge these. So this is its own module
(`service-request`) with its own tables, statuses, permissions, events and
number series (`SRQ-000123`). It deliberately **reuses the Ticket Engine's
proven patterns** rather than its code:

- system/tenant configurable **catalog** (`Service`, like `TicketCategory`),
- **SERIAL** auto-number + derived display string,
- **staff-XOR-vendor** assignment with the same validation,
- a dedicated **status service** that owns transitions (never in controllers),
- plain **actor ids** (reporter/assignee) validated in services, not FK-linked,
- tenant isolation via the Sprint 2 `CommunityAccessService` choke point.

Reusing patterns (not inheritance) keeps the two engines independent while
avoiding divergent conventions.

---

## 2. The workflow

`ServiceRequestStatusService` owns the map:

```
REQUESTED → ASSIGNED → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED
         ↘ CANCELLED / REJECTED (terminal)
```

`ACCEPTED → IN_PROGRESS` is allowed (skip explicit scheduling). Terminal states
can't be edited. Fine-grained gates: reaching `COMPLETED` needs
`service:complete`, `CANCELLED` needs `service:cancel`, everything else needs
`service:update`. Status changes stamp `actualStart` (on IN_PROGRESS),
`actualEnd`/`completedDate` (on COMPLETED) automatically. Covered by unit tests
(`service-request-status.service.spec.ts`): happy path, accept-to-progress,
cancels, illegal jumps, terminal, and `assertTransition` throwing.

---

## 3. Scheduling (deliberately minimal)

`preferredDate`, `preferredTimeSlot` (a free string like "Morning (9–12)"),
`actualStart`, `actualEnd`. No calendar engine, no recurrence — a dedicated
`/schedule` endpoint just sets these fields. That is the entire scope, per the
brief.

---

## 4. Assignment & feedback

- **Assignment** mirrors the Ticket Engine exactly: exactly one of
  `staffId`/`vendorId` (`hasStaff === hasVendor` → 400), staff must be in the
  community, vendor must cover it in the same tenant, `reassignedCount`
  increments, and `REQUESTED → ASSIGNED` auto-advances.
- **Feedback** (`ServiceFeedback`, 1:1) is a 1–5 rating + optional comment,
  allowed **only after completion** (enforced in the service) and idempotent
  (upsert, so a resident can revise it).

---

## 5. Ticket integration (loose coupling)

Two ways to connect, both storing only `ServiceRequest.ticketId` (a nullable
**scalar** — no FK, so the Ticket Engine stays independent and the ticket row is
never altered):

- **Link** an existing ticket (`POST …/ticket/link`) — validates the ticket is
  in the same community.
- **Create** a ticket from the request (`POST …/ticket`) — delegates to
  `TicketService.create()` (the module imports `TicketModule`), carrying over
  unit/title/description/resident with `source: INTERNAL`, then links it. This
  endpoint requires **both** `service:update` and `ticket:create`.

This is the only coupling, and it points one way (Service Request → Ticket
Engine). The Ticket Engine has no knowledge of service requests.

---

## 6. RBAC & events

New permissions `service:create/view/update/assign/complete/cancel`, granted to
Association Admin (all), Facility Manager (all), Resident (create/view — raise &
give feedback), Vendor (view/update/complete — fulfil assigned work). Data only,
no guard changes.

Events published (no delivery): `ServiceRequestCreated`, `ServiceAssigned`,
`ServiceAccepted`, `ServiceScheduled`, `ServiceStarted`, `ServiceCompleted`,
`ServiceCancelled`, `FeedbackSubmitted` — added to the existing typed catalog,
ready for a future notification module.

---

## 7. API surface (all under `/api/v1`)

```
POST   communities/:cid/service-requests        create        service:create
GET    communities/:cid/service-requests         list/filter   service:view
GET    service-requests/:id                       details       service:view
PATCH  service-requests/:id                        update        service:update
PATCH  service-requests/:id/status                 status        service:update (+complete/cancel)
PUT    service-requests/:id/assignment             assign        service:assign
PATCH  service-requests/:id/schedule               schedule      service:update
POST   service-requests/:id/ticket/link            link ticket   service:update
POST   service-requests/:id/ticket                 create ticket service:update + ticket:create
DELETE service-requests/:id                         soft delete   service:cancel
GET/POST service-requests/:id/feedback              feedback      service:view
GET/POST/PATCH/DELETE services                       catalog       service:view / service:update
```

---

## 8. Verification performed

- `prisma validate` + `generate` — valid (30 tables).
- **Incremental migration** `prisma/migrations/20260721010000_sprint5_service_request_engine/`
  (diffed from the Sprint 4 snapshot: 3 tables + 1 enum, `number` as SERIAL,
  **no ALTER on the tickets table** — proving the Ticket Engine is untouched).
- `nest build`, `eslint --max-warnings 0` — clean.
- `jest` — **41 tests pass** (+7 service-request workflow & number format).
- **DI-graph resolution** — full AppModule (Sprints 1–5), including the
  cross-engine `TicketModule` import, resolves without a DB.
- Seed adds the 8 system default services.

Runtime boot still requires `docker compose up -d` + `db:migrate deploy` +
`db:seed` (Docker unavailable in this build environment).

---

## 9. What was intentionally NOT built

No merge with the Ticket Engine, no calendar/recurrence, no notification
delivery (events only), no frontend (contracts only), no SLA/escalation. The
Ticket Engine remains independent; the Service Request Engine reuses its patterns
and links to it by id when operational tracking is needed — separate but
connected, exactly as specified.
