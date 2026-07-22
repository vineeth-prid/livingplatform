# Living Platform — Architectural Review (Sprint 2: Community Foundation)

Sprint 2 builds the **Community Foundation** on top of the Sprint 1 platform
substrate — the entities and configuration every future business engine
(tickets, visitors, assets, work orders, marketplace, payments) will attach to.
Nothing in Sprint 1 (auth, RBAC, tenancy, infra) was modified beyond additive
extension. This document explains the decisions and how they set up what comes
next.

---

## 1. The flexible property hierarchy (the central decision)

```
Community → Phase? → Block? → Floor? → Unit
```

Every level **below Community is optional**. The same tables model:

| Community type | Shape used |
| --- | --- |
| Apartment | Community → Phase → Tower(Block) → Floor → Unit |
| Villa | Community → Phase → Cluster(Block) → Unit (no floor) |
| Commercial | Community → Block → Floor → Shop(Unit) |
| Mixed | any combination, per unit |

**Why typed tables, not a generic tree.** A single self-referencing
`HierarchyNode` table would be "flexible" but would throw away the typed fields
each level genuinely has (a Block has `type`/`totalFloors`, a Floor has `level`,
a Unit has `bedrooms`/`area`/`ownership`). The brief explicitly enumerates those
fields. So we use explicit `Phase`/`Block`/`Floor`/`Unit` tables and get
flexibility from **nullable parent links** instead — `Block.phaseId`,
`Unit.blockId`, `Unit.floorId` are all optional. This is the lazy-but-correct
call: flexibility where it's needed (placement) without an EAV abstraction
nobody asked for.

**Denormalized `communityId` on every descendant.** Phase, Block, Floor, Unit,
Amenity and Document all carry `communityId` directly. This is a *materialized
ancestor key*, not duplicate data:

- **Tenant isolation** becomes a single indexed predicate on any table
  (`where communityId = …`) instead of a 4-level join up to the community.
- **"Everything connects to a community/unit"** — the Sprint brief's north star —
  is a direct foreign key, so future modules (a ticket on a unit, an asset in a
  block) resolve their community/tenant in one hop.

The consistency rule (a floor's `communityId` equals its block's) is enforced in
the services that create them.

---

## 2. Tenant isolation: one choke point

`CommunityAccessService.assert(communityId)` is the single gate every
Community-Foundation service calls before reading or writing child rows. It:

- loads the community, 404s if missing,
- 404s (not 403 — no existence leak) if the community is in another tenant,
- lets **platform** principals cross tenants.

Because `communityId` is denormalized and the parent is verified here once,
child queries filter by `communityId` alone — **no repeated tenant joins on the
hot path**. This is covered by unit tests
(`community-access.service.spec.ts`) that assert same-tenant allow, cross-tenant
deny, platform bypass, and not-found — the multi-tenant guarantee in runnable
form.

---

## 3. Consistent module shape

Every domain module (Community, Phase, Block, Floor, Unit, Amenity, Document,
Settings, Profile) follows the identical pattern, so a new business module drops
in the same way:

- **DTOs**: `Create*` (validated), `Update*` (`PartialType`), `Query*`
  (`extends ListQueryDto` → pagination + search + whitelisted sort).
- **Service**: `assert` access → operate → publish domain event; tenant-scoped;
  soft-delete via `deletedAt`; stamps `createdById`/`updatedById`.
- **Controller**: nested create/list (`/communities/:id/units`), flat item ops
  (`/units/:id`), `@RequirePermissions(...)` on every route, Swagger-annotated.

`resolveSort` whitelists sortable columns per resource — a client can never
order by an arbitrary column (tested).

---

## 4. Configurable RBAC extension

Six new permission groups were added to the catalog (`hierarchy`, `unit`,
`amenity`, `document`, `settings`, plus reuse of `community`) and granted to the
system roles by scope: Association Admin gets full CRUD, Facility Manager gets
operate-not-delete, Resident/Vendor get read. This is **data** — added to the
catalog and reseeded, no guard code touched — exactly the Sprint 1 promise that
new capabilities onboard without code changes. Profile routes carry **no**
permission gate: they are self-service (authentication is the only requirement),
which is a deliberate distinction from admin user management.

---

## 5. Domain events

`DomainEventsService` wraps `EventEmitter2` (wildcard namespacing) behind a
typed catalog (`CommunityCreated`, `BlockCreated`, `UnitCreated`, …). Services
publish; a template `DomainEventsListener` consumes `**` and mirrors events into
the audit trail. 

**Why a wrapper, not raw EventEmitter2.** Call sites depend on the seam, not the
transport. Moving to guaranteed async delivery later (an outbox table written in
the same transaction as the entity, relayed to a broker) changes only the
publisher — no emitter or listener changes. The outbox itself is intentionally
**not** built yet (no async consumer exists to justify it); the typed envelope
is the contract that future relay will carry.

---

## 6. Storage abstraction

`StorageService` depends on a `StorageProvider` interface bound by a DI token
(`STORAGE_PROVIDER`), selected by `STORAGE_DRIVER`. Business modules
(community logo, amenity image, document files, avatars) call `StorageService`
only — **never** a concrete backend. This sprint ships a `local` **stub**
(deterministic keys, placeholder signed URLs, no-op delete/exists) because no
uploads land yet; an S3/Azure/GCS provider is a new class implementing the same
interface with zero consumer changes. The document module already exercises the
seam via a signed-upload-URL endpoint.

---

## 7. Settings & Documents modelling

- **CommunitySettings** is 1:1 with Community, config-heavy → flexible JSON
  columns (working hours, policies, custom settings) alongside a few typed
  toggles/colors the UI binds directly. Upsert-only (no create/delete); every
  community is born with a settings row.
- **CommunityDocument** stores **metadata only** this sprint (`storageKey` stays
  null until a real upload). Category/status/tags/version/expiry are typed;
  `tags` uses a Postgres `text[]`. The storage seam is ready for bytes.

---

## 8. Search

`GET /communities/:id/search` fans out case-insensitive `contains` across units,
blocks, amenities and documents, returning grouped, typed hits. Deliberately
simple (DB scans) — the **response shape** is the contract a Postgres full-text
index or an external engine (OpenSearch/Meili) will later satisfy for
cross-community, ranked search. Gated by `community:read`.

---

## 9. Data model conventions (unchanged from Sprint 1)

Audit columns (`createdAt`, `updatedAt`, `deletedAt`, `createdById`,
`updatedById`) and soft delete (`deletedAt: null` filters) are applied to every
new domain table. Tenant isolation flows through `Community.tenantId`.

---

## 10. Verification performed

- `prisma validate` + `prisma generate` — schema valid, client generated (18 tables).
- **Baseline migration generated** — `prisma/migrations/20260720000000_init_community_foundation/`
  (via `migrate diff`, applyable with `prisma migrate deploy`).
- `nest build` — full TypeScript compile, no errors.
- `eslint --max-warnings 0` — clean.
- `jest` — **22 tests pass**: tenant isolation, permission enforcement, sort
  whitelisting, slug + duration utils.
- **DI-graph resolution** — the entire `AppModule` (all Sprint 1 + Sprint 2
  modules) instantiates without a database.
- Seed extended with an idempotent demo community foundation (Phase 1 › Tower A
  › 3 floors › 6 units, 3 amenities, 1 document).

Runtime boot against a live DB still requires `docker compose up -d` +
`db:migrate` + `db:seed` (Docker unavailable in this build environment).

---

## 11. What was intentionally NOT built

Per the Sprint brief: no tickets, work orders, marketplace, service requests,
visitor management, payments, or resident/owner people-domain. No real object
store (stub only), no outbox table, no search index, no bulk unit generation —
each is a documented, seam-ready upgrade rather than speculative scaffolding.

---

## 12. How this enables the next engines

- **Residents/Owners** attach to `Unit` (the People engine fills the
  owner/resident links `OwnershipType` anticipates).
- **Visitors** visit a `Unit`; **Tickets/Work Orders** originate from a `Unit`
  or common area; **Assets** belong to a `Unit`/`Block`; **Marketplace**
  delivers to a `Unit`. Each is one FK to the hierarchy that already carries
  `communityId` → `tenantId`, so isolation and scoping come for free.
- The **frontend pass** (next) consumes these REST endpoints: Community
  dashboard/list/detail, Hierarchy explorer, Unit/Amenity management, Settings,
  Documents, Profile — built on the Living Design System.
