# Backend Sprint 7 — Asset Foundation

The production-grade **Asset Domain**: assets become first-class citizens of the
platform, independent of every existing engine. This is the foundation the future
Preventive Maintenance, AMC, Inspection, QR-tracking, Lifecycle and Predictive
Maintenance capabilities build on — none of which will require refactoring this
model.

It reuses the platform completely (tenancy, storage, events, audit, RBAC,
pagination/sort/validation helpers, Prisma, NestJS module boundaries) and changes
**no existing engine**.

## Independence & coupling

Assets are **referenced, never owned**. Work Orders and Service Requests each gain
a nullable scalar `assetId` — a **loose reference with NO foreign key**, exactly
like the Work Order's `originId` and the Service Request's `ticketId`. This keeps
every engine independent: the Asset Engine has no reverse `workOrders[]` /
`serviceRequests[]` relation, and the existing engines' code is untouched.

The `WORK_ORDER_LINKED` / `SERVICE_REQUEST_LINKED` event types exist in the
`AssetEventType` enum and the `assetId` columns exist on both engines as the
**forward-compatible seam** — when a future sprint wires "link this asset to a
work order", it sets `assetId` and records the event, with zero schema change.

## Domain model

```
AssetCategory (self-nesting)
   └─ Asset ──┬─ AssetDocument   (metadata, StorageService)
              ├─ AssetPhoto      (metadata, StorageService)
              └─ AssetEvent      (immutable, append-only history)

Community → Block → Floor → Unit → Asset   (all location links optional)
```

- **AssetCategory** — community-scoped, self-referencing taxonomy (Electrical,
  HVAC, Lift, Fire Safety, STP, WTP, DG, Security, …). Unique `code` per
  community; a category with assets cannot be deleted.
- **Asset** — the register entry: identity (`assetCode` unique per tenant,
  `serialNumber` unique per tenant, barcode, qrCode), classification (category,
  status, criticality, condition), location (free text + optional block/floor/
  unit), lifecycle dates (purchase/installation/warranty + expected life), and a
  free-form `metadata` bag for IoT/PM config to come.
- **AssetDocument / AssetPhoto** — metadata rows; bytes flow through the existing
  `StorageService` signed-URL pattern (provider-agnostic, still a metadata stub).
- **AssetEvent** — the asset's immutable, structured timeline (never formatted
  text): `CREATED / UPDATED / STATUS_CHANGED / LOCATION_CHANGED / DOCUMENT_ADDED /
  PHOTO_ADDED / WORK_ORDER_LINKED / SERVICE_REQUEST_LINKED / ARCHIVED`.

## Multi-tenancy & isolation

Every `Asset` and `AssetCategory` carries `tenantId` + `communityId`. Reads and
writes route through `CommunityAccessService.assert(communityId)` — the single
choke point that verifies tenant ownership (and returns 404, never 403, so
existence never leaks). List endpoints **require** a `communityId` query param;
create takes it in the body. Uniqueness (asset code, serial number) is scoped to
the tenant. Assets never leak across communities.

## Validation

Enforced in the service before any write: duplicate asset code (per tenant),
duplicate serial number (per tenant), category existence within the community,
block/floor/unit ownership within the community, and lifecycle-date ordering
(`assertAssetDatesConsistent` — you can't install before purchase, and a warranty
can't expire before purchase; pure and unit-tested).

## Events & audit

Mutations emit **domain events only** (never notifications): `AssetCreated`,
`AssetUpdated`, `AssetStatusChanged`, `AssetMoved`, `AssetPhotoAdded`,
`AssetDocumentAdded`, `AssetArchived` — through the shared `DomainEventsService`
(EventEmitter2 today, outbox-ready). Every mutating request is captured by the
global `AuditInterceptor` automatically (resource derived from the route), and
each mutation additionally appends a structured `AssetEvent` to the asset's own
history inside the same transaction.

## API

Flat, resource-oriented routes (matching the spec), all permission-guarded:

| Method | Route | Permission |
| --- | --- | --- |
| GET/POST | `/asset-categories` | `asset:read` / `asset:category:manage` |
| GET/PATCH/DELETE | `/asset-categories/:id` | `asset:read` / `asset:category:manage` |
| GET/POST | `/assets` | `asset:read` / `asset:create` |
| GET/PATCH/DELETE | `/assets/:id` | `asset:read` / `asset:update` / `asset:delete` |
| GET | `/assets/:id/events` | `asset:read` |
| GET/POST | `/assets/:id/documents` (+ `/upload-url`) | `asset:read` / `asset:document:create` |
| GET/POST | `/assets/:id/photos` (+ `/upload-url`) | `asset:read` / `asset:photo:create` |

Filters: search, category, status, criticality, condition, community, block,
floor, unit, warranty/installation/purchase date ranges. Sort whitelist: name,
assetCode, category, status, criticality, createdDate, warrantyExpiry. `DELETE`
is a **soft archive** — the register keeps its lifecycle history.

## Permissions

New: `asset:read`, `asset:create`, `asset:update`, `asset:delete`,
`asset:category:manage`, `asset:document:create`, `asset:photo:create`. Granted to
Association Admin (full), Facility Manager (full register except hard delete), and
Vendor (read-only — they can see the assets they service). Residents get none.

## A note on structure

The prompt's idealized folder list (repository/entities/mappers/validators
sub-folders) is **not** how this codebase is built — the established engines use a
service that talks to Prisma directly, DTOs in `dto/`, permissions in the RBAC
catalog, and inline mappers. "Reuse the existing architecture completely" wins
over the idealized layout, so the Asset module mirrors the Work Order engine's
real structure exactly (`asset.service.ts`, `asset-category.service.ts`,
`asset-document.service.ts`, `asset-photo.service.ts`, `asset-event.service.ts`,
`asset.controllers.ts`, `dto/`). No repository layer was added because the
platform has none — that would be the duplicated infrastructure the brief forbids.

## SDK

`living.assets.{list,get,create,update,archive,events,documents,photos,…}` and
`living.assetCategories.{list,get,create,update,remove}`, with matching types in
`@living/types` (`Asset`, `AssetCategory`, `AssetDocument`, `AssetPhoto`,
`AssetEvent` + the four enums).

## Verification

- `prisma validate` + `prisma generate` — clean.
- `nest build` — clean. `eslint --max-warnings 0` — clean.
- Jest — **55 tests pass** (7 new: asset date-consistency + catalog constants).
- All 11 workspace projects typecheck (SDK/types consumers included).
- Migration `20260722000000_sprint7_asset_foundation` (4 enums, 5 tables, loose
  `assetId` on work_orders + service_requests). Not run against a live DB (no
  Docker on this host — consistent with Sprints 3–6).
