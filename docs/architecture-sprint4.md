# Living Platform — Architectural Review (Sprint 4: Ticket Engine)

Sprint 4 delivers the **Ticket Engine** — the generic operational core. It is
deliberately domain-agnostic: there is no plumbing/electrical/housekeeping code
anywhere. The **Category** carries business context, so every future workflow
(Service Requests, Preventive Maintenance, Visitor Issues, Marketplace Support,
Property/NRI Services) creates and manages tickets **without changing this
engine**. Sprints 1–3 were not modified beyond additive relations and the new
permission/event entries.

---

## 1. Why the engine stays generic

The one rule that keeps this reusable: **the engine knows about Ticket,
Category, Assignment, Status, Comment, Attachment, Timeline — and nothing about
what a ticket is *for*.** A "plumbing complaint" is just a Ticket with the
Plumbing category. A future "preventive maintenance job" will be a Ticket with a
PM category created by the PM module. No subclasses, no per-domain tables.

Categories follow the **system-vs-tenant** pattern already used for Roles:
`TicketCategory.tenantId = null` is a seeded system default available to every
tenant; a tenant can add its own. 13 defaults are seeded (Electrical … General).

---

## 2. Data model & the "reference by id" boundary

Five tables: `Ticket`, `TicketCategory`, `TicketComment`, `TicketAttachment`,
`TicketTimeline`.

A Ticket has **FK relations** to the things it structurally belongs to and that
enforce integrity: `Community` (cascade), `Unit` (restrict), `TicketCategory`
(restrict), `Resident` (optional, set-null). But **reporter, assignee and every
actor id are plain columns** (`reportedById`, `assignedStaffId`,
`assignedVendorId`, `assignedById`, comment `authorId`, timeline `actorId`) —
the same deliberate pattern as `AuditLog`. The engine validates these ids in its
services but does **not** FK into the People tables, so the Ticket Engine never
reaches back into (or is coupled to) People internals. This is what lets future
modules point tickets at any actor without a schema change here.

Tenant isolation reuses the Sprint 2 `CommunityAccessService.assert()` choke
point on `communityId` — no new isolation logic. Audit columns, soft delete and
indexes match every prior sprint.

**Ticket numbers.** `number` is a Postgres `SERIAL` (`@default(autoincrement())`,
unique) — race-free and gap-tolerant. The human display number `TKT-000123` is
derived in `formatTicketNumber()`, not stored, so there's no second write and no
nullable column. Search accepts `TKT-000123`, `123`, or free text (it strips
non-digits to match `number`).

---

## 3. Status workflow as data (not code in controllers)

Per the brief, transitions are **not** hardcoded in controllers.
`TicketStatusService` owns a transition map and exposes
`canTransition`/`assertTransition`/`allowedNext`/`isTerminal`:

```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
   ↘ ON_HOLD ↔ IN_PROGRESS      ↘ reopen → IN_PROGRESS
   ↘ CANCELLED (terminal)
```

Changing the workflow is a one-line map edit, and future modules reuse the same
rules. Fine-grained gates layer on top: reaching `RESOLVED` needs
`ticket:resolve`, `CLOSED` needs `ticket:close`, and **closed tickets are
read-only except to holders of `ticket:close`** (the "privileged users" rule).
Covered by unit tests (`ticket-status.service.spec.ts`): happy path, reopen,
illegal jumps, no-op, terminal, and `assertTransition` throwing.

---

## 4. Assignment: staff XOR vendor

`assign()` enforces **exactly one** of `staffId` / `vendorId` (`hasStaff ===
hasVendor` → 400). Staff must belong to the ticket's community; a vendor must
cover it (`communityIds has communityId`) within the same tenant. Assigning
increments `reassignedCount` when already assigned, stamps
`assignedBy`/`assignedAt`, auto-advances `OPEN → ASSIGNED` via the status
service, and records `ASSIGNED`/`REASSIGNED` on the timeline. The two id columns
are mutually exclusive by construction (one is always set to `null`).

---

## 5. Timeline: structured, never formatted

`TicketTimeline` stores `{ type, actorId, reference, metadata, createdAt }` —
**no formatted sentences**. `reference` holds a related id (comment/attachment)
or a `"OPEN->ASSIGNED"` status pair; `metadata` holds notes/flags. The UI
composes the human sentence. `TicketTimelineService.record()` accepts an
optional transaction client so the CREATED event is written atomically with the
ticket. This is the ticket's own history, distinct from the global audit log.

---

## 6. Comments & attachments

- **Comments** carry an `isInternal` flag. Internal comments are filtered out
  for callers lacking `ticket:update` (residents see only public comments;
  staff/admin see all). Residents, staff, vendors and admins can all comment.
- **Attachments** are metadata only, with bytes handled through the Sprint 2
  `StorageService` abstraction — an `upload-url` endpoint returns a signed target
  and key, then the client registers the attachment. No coupling to any object
  store; no file bytes handled by the API this sprint.

---

## 7. Events, not notifications

The engine **publishes domain events** and builds no delivery:
`TicketCreated`, `TicketAssigned`, `TicketStatusChanged`, `TicketResolved`,
`TicketClosed`, `TicketCommentAdded` — added to the existing typed catalog. A
future notification module subscribes with an `@OnEvent` handler (the seam is
already there — the audit listener consumes `**` today). This keeps the engine
oblivious to email/SMS/push.

---

## 8. Dashboard APIs

`GET /communities/:id/tickets/dashboard` returns summary counts only (open,
assigned, in-progress, on-hold, resolved-today, closed-today, critical-open,
plus by-status / by-priority / by-category breakdowns) via Prisma `groupBy`.
No charts, no frontend — just the aggregates a dashboard will bind to.

---

## 9. API surface (all under `/api/v1`)

```
POST   communities/:cid/tickets              create           ticket:create
GET    communities/:cid/tickets              list/filter/search ticket:view
GET    communities/:cid/tickets/dashboard    summary          ticket:view
GET    tickets/:id                           details          ticket:view
PATCH  tickets/:id                           update           ticket:update (+close-lock)
PATCH  tickets/:id/status                    change status    ticket:update (+resolve/close)
PUT    tickets/:id/assignment                assign staff|vendor ticket:assign
DELETE tickets/:id                           soft delete      ticket:delete
GET    tickets/:id/timeline                  timeline         ticket:view
GET/POST tickets/:id/comments                comments         ticket:view / ticket:comment
GET    tickets/:id/attachments               list             ticket:view
POST   tickets/:id/attachments/upload-url    signed url       ticket:comment
POST   tickets/:id/attachments               register         ticket:comment
GET/POST/PATCH/DELETE ticket-categories      manage           ticket:view / ticket:update
```

Permissions granted: Association Admin (all), Facility Manager (all but delete),
Resident (create/view/comment), Vendor (view/update/comment/resolve). All added
to the catalog as data — no guard changes.

---

## 10. Verification performed

- `prisma validate` + `generate` — valid (27 tables).
- **Incremental migration** `prisma/migrations/20260721000000_sprint4_ticket_engine/`
  (diffed from the Sprint 3 snapshot: 5 tables + 4 enums, `number` as SERIAL,
  no changes to existing tables). Applyable with `migrate deploy`.
- `nest build`, `eslint --max-warnings 0` — clean.
- `jest` — **34 tests pass** (+7 status-transition & number-format; existing
  tenant-isolation, permission, user-link, sort, util suites still green).
- **DI-graph resolution** — full AppModule (Sprints 1–4) resolves without a DB.
- Seed adds the 13 system default categories.

Runtime boot still requires `docker compose up -d` + `db:migrate deploy` +
`db:seed` (Docker unavailable in this build environment).

---

## 11. What was intentionally NOT built

No notification delivery (events only), no service-specific logic, no frontend
(API contracts only, per the brief), no SLA/escalation engine, no row-level
"vendors see only their assigned tickets" (permission-level for MVP — a
documented future refinement), no attachment byte handling (StorageService stub).
Each is a seam-ready extension, not scaffolding built ahead of need.

---

## 12. How future modules reuse this

A Service Request, PM job, visitor issue or marketplace support case is created
by calling the ticket create flow with the appropriate **category** and
metadata. They subscribe to ticket events for their own side effects. Because
reporter/assignee are id references (not FKs into People) and category is data,
none of them require a change to the engine — which was the entire point.
