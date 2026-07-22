# Backend Sprint 10 — Community Operations

The **resident-facing operational layer**: the everyday community-life services —
visitor management, amenity bookings, and announcements — plus the *reuse* of the
existing amenity and document registers. Residents invite visitors, book
amenities, read notices; managers administer it all through the shared platform.

It reuses the whole platform (Resident/People, Community, StorageService, tenancy,
events, audit, RBAC, pagination/sort/validation, the shared `@nestjs/schedule`
registry) and changes **no existing engine's code**.

## What is new vs. what is reused

Two of the five listed concerns **already exist** from the Community Foundation
(Sprint 2) — the `Amenity` model (its `isBookable` field literally says "booking
engine arrives later") and the `CommunityDocument` model + `document` module
(StorageService upload, categories, RBAC). "Reuse the platform, don't duplicate"
means using those, **not** creating rival models. So:

| Concern | Approach |
| --- | --- |
| **Visitor Management** | **New** — `Visitor` model + module |
| **Amenity Booking** | **New** — `AmenityBooking` model + module; reads the existing Amenity |
| **Announcements** | **New** — `Announcement` model + module |
| **Amenities** | **Reused** — the Sprint 2 `amenity` module (create/update/deactivate) |
| **Community Documents** | **Reused** — the Sprint 2 `document` module (upload/category/RBAC) |

The only schema touch to a reused model is **additive**: two nullable-with-default
booking-config columns on `Amenity` (`bookingWindowDays`, `slotDurationMinutes`),
read by the Booking engine. The amenity module's code is untouched. This mirrors
the additive-column precedent from Sprint 7 (`WorkOrder.assetId`).

## Visitor Management

`Visitor` (host resident, name, mobile, vehicle, type, expected arrival, status,
a unique human-readable **passCode**). Lifecycle: residents **create / edit /
cancel**; staff (Facility Manager) **approve / reject / check-in / check-out** —
each guarded by its own permission and a strict status machine (e.g. only an
`APPROVED` visit can check in; a `CHECKED_IN` visit can't be cancelled). Pass
codes are generated from an unambiguous alphabet (no `0/O/1/I/L`) with DB-level
uniqueness. No QR yet — the code is the token.

**Data ownership**: a resident only ever sees and acts on their *own* visitors
(matched via the linked `userId`); a manager (holding `visitor:approve`) sees the
whole community. Shared `assertResidentOwnership` / `myResidentIds` helpers
enforce this for both visitors and bookings.

## Amenity Booking

`AmenityBooking` (amenity, resident, date, start/end, status). Booking validates,
in order: resident ownership, amenity belongs to the community and is **active +
bookable**, valid time range, **future within the amenity's booking window**,
**within operating hours** (read from the existing `operatingHours` JSON), and
**capacity** — a count of active overlapping bookings must stay under the
amenity's capacity (capacity 1 ⇒ "no double-booking"; N ⇒ up to N concurrent).
The overlap/hours/window/range rules are pure and unit-tested. Bookings confirm
instantly; residents cancel their own, managers manage any.

## Announcements

`Announcement` (title, content, priority, `publishAt`, `expiresAt`, status).
Managers **create / update / publish / expire**; residents **read only
currently-visible** ones (published, publish time reached, not expired — enforced
in the query, so drafts and expired notices never leak to residents). An **hourly
sweep** (reusing the scheduler registry) auto-publishes drafts whose `publishAt`
has arrived and expires published ones past `expiresAt`, via idempotent
compare-and-swap, emitting `AnnouncementPublished` / `AnnouncementExpired`.
`ANNOUNCEMENT_SWEEP_ENABLED=false` disables it.

## Permissions, events, audit, multi-tenancy

- **New permissions**: `visitor:*` (read/create/update/approve/checkin/checkout),
  `booking:*` (read/create/update/cancel), `announcement:*` (read/create/update/
  publish). `amenity:*` and `document:*` already exist and are reused. Residents
  gain visitor/booking self-service + announcement read; the Facility Manager runs
  the front desk and notices; the Association Admin has everything.
- **Events** (domain events only): `VisitorCreated/Approved/CheckedIn/CheckedOut`,
  `BookingCreated/Cancelled`, `AnnouncementPublished/Expired`. `AmenityCreated`
  and `DocumentAdded` are already emitted by the reused modules.
- Every API mutation is captured by the global `AuditInterceptor`. Every entity
  carries `tenantId` + `communityId`; all reads/writes route through
  `CommunityAccessService.assert`; lists require a `communityId`. Nothing crosses
  communities.

## SDK

`living.visitors.*`, `living.bookings.*`, `living.announcements.*` (new), plus
`living.amenities.*` and `living.documents.*` — focused namespaces over the
reused Sprint 2 endpoints. Types `Visitor`, `AmenityBooking`, `Announcement` +
five enums in `@living/types` (the `Amenity` type gains the two booking-config
fields).

## A note on the spec's Document enums

The prompt's `DocumentCategory` (BYELAW/MINUTES/…) and `DocumentVisibility`
(PUBLIC/RESIDENT/STAFF/MANAGEMENT) **conflict with the existing** `DocumentCategory`
(ASSOCIATION/RULES/…) already in use by the live document module and the resident
PWA. Introducing them would break the reused engine, so they are **not** added —
documents keep the existing category set, and access stays RBAC-driven (already
"permission-aware"). Per-tier document visibility would be an additive enhancement
to the existing document module, deferred to avoid modifying a previous engine.

## Verification

- `prisma validate` + `generate` — clean.
- `nest build` — clean. `eslint --max-warnings 0` — clean.
- Jest — **83 tests pass** (7 new: booking time-range, window, operating-hours,
  overlap).
- All 11 workspace projects typecheck.
- Migration `20260722030000_sprint10_community_operations` (5 enums, 3 tables,
  2 additive Amenity columns). Not run against a live DB (no Docker on this host —
  consistent with Sprints 3–9). The announcement sweep is gated by
  `ANNOUNCEMENT_SWEEP_ENABLED`.
