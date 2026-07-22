# Living Platform — Architectural Review (Sprint 3: People Foundation)

Sprint 3 adds the **minimum** people data operations need — Residents, Vendors,
Staff, and Resident↔Unit mapping — with one goal: **make the Sprint 4 Ticket
Engine easy to build**. Nothing in Sprints 1–2 was modified beyond additive
extension (new enums, new permissions, new relation back-references). Deliberately
lean: no KYC, vehicles, pets, ownership model, family tree, HR, contracts,
compliance, or history.

---

## 1. Who these entities are (and why the scoping differs)

| Entity | Scope | Why |
| --- | --- | --- |
| **Resident** | Community | A resident lives in a unit, in one community. |
| **Staff** | Community | Staff operate a community; they'll be assigned tickets there. |
| **Vendor** | **Tenant** | Vendors cover *many* communities under a tenant. |

Residents and Staff carry `communityId` and reuse the Sprint 2
`CommunityAccessService.assert()` choke point — same tenant-isolation guarantee,
zero new isolation code. Vendors carry `tenantId` and are scoped on it directly
(they have no single community); coverage is a denormalized `communityIds[]`
array queried with `has`. This mirrors the real operational model instead of
forcing vendors into a community they don't belong to.

---

## 2. Resident ↔ Unit mapping

`ResidentUnit` is a dedicated table (`residentId` **unique** → one current unit
per resident; `unitId` non-unique → many residents per unit), with `role`
(PRIMARY/SECONDARY), move-in/out dates and status. Per the brief there's **no
occupancy history** — re-assigning upserts the single row; unassigning deletes
it. Assignment validates the unit belongs to the resident's community.

**Why a join table and not a `unitId` column on Resident.** The Ticket Engine
and future People features (owners, tenancy) will grow the relationship
(primary/secondary is already here); a join row is the natural place for that
without reshaping Resident. It stays 1:1 today via the unique constraint.

Residents are filterable by tower/floor/unit by traversing this relation
(`unitAssignment.unit.blockId`), so the Sprint 2 hierarchy powers people
queries for free.

---

## 3. User linking — one profile per user (the key invariant)

Each of Resident/Vendor/Staff has an optional, **unique** `userId`. Uniqueness
per table is a DB constraint; the cross-table rule ("a user maps to at most one
profile") is enforced by **`UserLinkService.assertLinkable()`**, which also
checks the user is in the same tenant. This is the seam that lets a real person
log in and be resolved to their operational identity **without a duplicate
account** — exactly what the Ticket Engine needs to answer "the authenticated
user is *which* resident/staff/vendor?".

This invariant is covered by unit tests (`user-link.service.spec.ts`):
unlinked-ok, missing-user, wrong-tenant, already-linked-elsewhere, and
re-saving-own-link via `exclude`.

---

## 4. Conventions carried over (no new patterns invented)

Every module is the identical shape established in Sprint 2 — `Create/Update/
Query` DTOs (`PartialType`, `ListQueryDto` for pagination+search+whitelisted
sort), thin controllers with `@RequirePermissions`, services that assert access →
operate → publish a domain event, soft delete via `deletedAt`, audit columns
stamped from the principal, global audit interceptor. Search (name/phone/email/
code) and filters (resident: status/tower/floor/unit; vendor: category/status/
coverage; staff: role/department/status) are plain indexed `where` clauses.

New RBAC permissions (`resident:*` incl. `assign`, `vendor:*`, `staff:*`) were
added to the catalog and granted to Association Admin (full) and Facility
Manager (operate) — **data only, no guard changes**, as designed.

Domain events (`ResidentCreated`, `ResidentAssignedToUnit`, `VendorCreated`,
`StaffCreated`) were added to the existing typed catalog — cheap, consistent,
and ready for the Ticket Engine or notifications to consume later.

---

## 5. Verification performed

- `prisma validate` + `generate` — valid (22 tables total).
- **Incremental migration** generated from the Sprint 2 schema snapshot →
  `prisma/migrations/20260720010000_sprint3_people_foundation/` (4 tables +
  6 enums, no changes to existing tables). Applyable with `migrate deploy`.
- `nest build`, `eslint --max-warnings 0` — clean.
- `jest` — **27 tests pass** (+5 user-linking; tenant isolation, permissions,
  sort whitelist, utils).
- **DI-graph resolution** — full AppModule (Sprints 1–3) resolves without a DB.
- Seed extended with a demo resident (on unit A-101), vendor and staff.

Runtime boot still requires `docker compose up -d` + `db:migrate deploy` +
`db:seed` (Docker unavailable in this build environment).

---

## 6. How this sets up Sprint 4 (the Ticket Engine)

A ticket needs a **reporter** and a **subject/location** and an **assignee**:

- **Reporter** → `Resident` (or any `User`), already tied to a `Unit` via
  `ResidentUnit`, and resolvable from the logged-in user through the unique
  `userId` link.
- **Location** → `Unit` / `Block` / `Amenity` from the Sprint 2 hierarchy, all
  carrying `communityId` for one-hop tenant scoping.
- **Assignee** → `Staff` (internal) or `Vendor` (external), filterable by
  role/category — so routing "assign this plumbing ticket to a plumber or a
  plumbing vendor covering this community" is a query over data that now exists.

Every people entity connects to the community/unit graph, so the Ticket Engine
adds one module with FKs into what's here — no rework of this sprint.
