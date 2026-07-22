# Frontend Sprint 7 — Asset Management Experience

The operational home for every physical asset in Living — a premium, enterprise-
grade admin experience in the **portal**, surfacing the Sprint 7 backend Asset
Engine. Built entirely on the existing Living frontend (design system, master-data
scaffold, SDK, hooks, router, permissions); **no new UI systems, no backend
changes**.

## Structure

At `apps/portal/src/features/assets/`:

```
config.ts / config.test.ts   status/criticality/condition tones + pure warrantyState (4 tests)
queries.ts                   useAsset / categories / location options / events / photos / documents / mutations
location.ts                  block · floor · unit · free-text → one location string
asset-badges.tsx             AssetStatusBadge · CriticalityPill · ConditionPill · WarrantyIndicator
tabs.tsx                     a token-styled tab strip with an animated underline
assets-list.tsx              the Asset Register (table + card views)
asset-card.tsx               the card-view tile
asset-form.tsx               the multi-section create/edit form
asset-create-page.tsx        /assets/new
asset-detail.tsx             /assets/:id — split layout + tabs + edit drawer
asset-overview / -photos / -documents / -events   the five detail tabs
```

Routes are **lazy-loaded** (`/assets`, `/assets/new`, `/assets/:id`), each its own
chunk, behind a `Suspense` boundary added to the dashboard shell. A new **Assets**
entry sits under the Operations nav section.

## Asset Register (`/assets`)

Built on the shared `ListScaffold` + `useListQuery` (URL-synced, deep-linkable
search/sort/filter/pagination — zero list plumbing duplicated):

- **Table view** — Code · Name · Category · Location · Status · Installed ·
  Warranty (health indicator) · Updated, plus per-row Open/Edit quick actions
  (Edit deep-links to the detail with the edit drawer open, RBAC-gated).
- **Card view** — a responsive grid of premium cards (category-tinted icon,
  status badge, warranty indicator, hover lift). The toggle persists to
  `localStorage`; card view reuses the same paginated query, so filters, search
  and pagination stay shared.
- **Filters** — Category (live from the API), Status, Block, Floor, and a
  Warranty-expiring window (30/60/90 days, translated to the API's `warrantyTo`).
- **Sort** — Name, Code, Category, Status, Warranty (the backend's sortable set).
- **Empty/loading/error** — premium empty states with a create CTA, skeleton
  grids, and the scaffold's inline error+retry.

## Create (`/assets/new`)

A full-page **multi-section** form — General, Location, Lifecycle, Warranty,
Classification — with **realtime validation** (required fields + lifecycle date
ordering, mirroring the backend rules client-side) and **draft-safety**: create
input is debounce-persisted to `localStorage`, so navigating away never loses
work, and cleared on submit. Photos and documents are added on the asset's page
once it exists (they need an id) — the form says so rather than pretending.

## Detail (`/assets/:id`)

A **split layout**: a sticky summary panel on the left (icon, name, code, status,
warranty, category, location, install date, quick Edit/Archive) and **tabbed
content** on the right:

- **Overview** — a calm information layout: identity, lifecycle, warranty, and a
  **Relationships** block with honest empty states for PM plans / AMC / work
  orders (no fabricated data — those integrations are future sprints).
- **Photos** — a responsive grid with an animated Framer Motion **lightbox** and
  upload via the StorageService signed-URL flow. Storage is still a metadata
  stub, so images degrade gracefully to a placeholder.
- **Documents** — list + upload + download (signed URLs).
- **History** — the asset's structured event log as a shared `Timeline`, newest first.
- **Events** — a detailed event list (type · time · description · user), ready
  for the PM integration to come.

Editing happens in a right-hand **Sheet** reusing the same multi-section form in
edit mode. Archive uses the shared confirm dialog → `living.assets.archive`.

## Cross-cutting

- **Permissions** — `asset:create/update/delete` gate the New button, Edit and
  Archive actions and the upload controls (via `<Can>` / `hasPermission`); nothing
  unauthorized renders.
- **Animation** — Framer Motion only: page transitions (shared `PageTransition`),
  card hover lift, the tab underline (`layoutId`), and the lightbox — all subtle,
  fast, reduced-motion aware.
- **Accessibility** — `role`/`aria-selected` tabs and view toggle, focus-visible
  rings, labelled icon buttons, keyboard-navigable dialogs (shared primitives).
- **Performance** — route-level lazy loading + code splitting; TanStack Query
  caching with `keepPreviousData`; memoized derived options; debounced server-side
  search.

## Deliberate scope calls

- **No row virtualization.** The register is server-paginated (20/page), so
  virtualization would add a dependency for no gain; pagination is the right tool
  at this page size. (The spec listed it under performance; noted, not needed.)
- **No Vendor filter** on the register — the asset API has no `vendorId` field
  (asset↔vendor is via AMC coverage, a different engine). Omitted rather than
  faking a client-side filter or touching the backend.
- **No photo/document delete** — the backend exposes list + add only; delete is
  omitted (same as work-order attachments) until an API lands.
- **Bulk selection** — reserved for future, per the spec.

## Verification

- `pnpm --filter @living/portal typecheck` — clean.
- `pnpm --filter @living/portal test` — **23 tests pass** (4 new: warrantyState).
- `pnpm --filter @living/portal build` — clean; asset routes emit their own chunks.
- All 11 workspace projects typecheck. Not run against a live API (needs the
  backend up).
