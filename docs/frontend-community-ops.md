# Frontend Sprint 9 — Community Operations Experience

The resident-facing operational layer, delivered across **all three apps** —
Portal (managers), Resident PWA (residents), Workforce PWA (security) — surfacing
the Sprint 10 Community Operations backend (visitors, amenities, bookings,
documents, announcements). Built entirely on the existing Living frontend; no new
UI framework, no backend changes.

## Portal — the manager experience

Five features under a new **Community ops** sidebar section, all lazy-loaded,
reusing `ListScaffold` + `useListQuery`, the shared `register-view` toggle,
`form-kit`, `tabs`, and `FormDrawer`:

- **Visitors** (`/visitors`, `/visitors/:id`) — table + card register (search,
  status/type/resident filters, date filter), invite drawer, and a split detail
  with a big **gate pass** display, Overview/History tabs, and the lifecycle
  actions. A shared `VisitorActions` component renders approve/reject/check-in/
  check-out gated by status **and** permission — reused by the workforce gate.
- **Amenities** (`/amenities`) — manage facilities (name, category, location,
  capacity, operating hours, bookable flag, activation) in an edit drawer.
- **Bookings** (`/bookings`) — table **and** a day-grouped calendar view; cancel
  actions; amenity/resident/status filters.
- **Documents** (`/documents`) — reuses the existing document module: category
  filter, search, upload (StorageService signed-URL flow), download.
- **Announcements** (`/announcements`) — draft/publish/expire lifecycle with
  inline publish & expire actions, a create/edit drawer, and priority/status
  filters.

## Resident PWA — the resident experience

The Sprint 5 home placeholders are replaced with **live widgets**: top
announcements, upcoming bookings, and recent visitors (each linking to its
screen). Four new screens on the existing mobile shell + component kit
(`ListCard`, `Section`, `QuickAction`, bottom `Sheet`s):

- **Announcements** — priority-filtered list with a read sheet.
- **Visitors** — the resident's own visitors with pass codes, an invite bottom
  sheet, and cancel.
- **Bookings** — upcoming / past / cancelled history with cancel.
- **Amenities** — browse bookable facilities and reserve a slot in a bottom sheet.

## Workforce PWA — the security experience

A new **Gate** tab (5th bottom-nav item) — a live, auto-refreshing visitor queue
grouped into **Pending approval / Expected / Checked in / Recently out**, with
search and the full lifecycle (approve, reject, check in, check out) as big
one-tap actions, each gated by the operator's permission. Workers without visitor
permissions see a clean "no gate access" state.

## Cross-cutting

- **Permissions & data scope** — every action is RBAC-gated; the backend already
  scopes residents to their own visitors/bookings, staff to operational views,
  and managers to everything, so the UIs simply render what each role can see.
- **Reuse** — no new UI systems: portal shares its register/tabs/form kit; the
  resident and workforce apps reuse their existing mobile shells and components;
  the document module is reused as-is.
- **Motion / a11y / performance** — Framer Motion (cards, sheets, tab underline,
  page fades), `role`/`aria` on tabs/toggles/queues, focus-visible rings; portal
  routes lazy-loaded and URL-persisted, resident/workforce screens code-split.

## Two honest constraints (no backend changes)

1. **Resident create needs a `residentId` the resident can't look up.** Creating
   a visitor or booking requires the caller's resident-profile id, but the
   RESIDENT role has no `resident:read` and there is no `/me/resident` endpoint.
   The PWA resolves it **best-effort** from the resident list (works for
   manager/demo accounts) and **degrades gracefully** — the invite/book controls
   hide with a "ask management to link your account" note when it can't resolve.
   Read experiences (announcements, bookings history, visitor tracking, amenity
   browse, documents) are fully functional. Closing this cleanly needs a small
   backend addition (a `/me/resident` lookup or a self-scoped `resident:read`),
   out of scope for a frontend sprint.
2. **Amenity booking window / slot length are read-only.** The existing amenity
   DTO (Sprint 2) doesn't accept the Sprint-10 `bookingWindowDays` /
   `slotDurationMinutes` columns, so the portal manages the settable fields
   (operating hours, capacity, bookable, status) and shows the booking-config as
   read-only info — modifying the amenity engine's DTO was out of scope.

## Verification

- `pnpm -r typecheck` — all 11 workspace projects clean.
- `pnpm --filter @living/portal test` — **31 tests pass** (existing suite intact).
- Portal, resident, and workforce all `build` clean (portal routes code-split;
  the two PWAs still emit their service workers).
- Not run against a live API.
