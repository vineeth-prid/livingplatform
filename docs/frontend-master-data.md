# Living Platform — Community & People Management (Frontend Sprint 2)

The master-data experience: browse, search, and manage **Community, Units,
Residents, Staff, and Vendors**. Built entirely on the Sprint 0 foundation and
the Sprint 1 community context — no architecture changes. Blocks and Floors are
surfaced within the Community overview and as Unit filters (their natural home
in the hierarchy), not as separate CRUD screens.

---

## 1. One scaffold, five modules

The design principle — **browsing over editing** — plus "do not duplicate
components" point to a single configurable scaffold that each module wires with
data. It lives in `features/master-data/`:

| Piece | Responsibility |
| --- | --- |
| `useListQuery` | URL-synced list state (page/search/sort/filters) → paginated SDK query, previous page kept during fetch (no jumps). **Deep-linkable.** |
| `ListScaffold` | The one list experience: search + quick filters + sortable `DataTable` + pagination + loading/empty/error, permission-gated "New". |
| `DetailShell` + `DetailHeader`/`DetailSection`/`Field`/`FieldGrid` | The detail experience: large profile header, grouped sections, label/value rows, placeholder sections. |
| `FormDrawer` | Config-driven create/edit in a `Sheet` — lean controlled form (no form library; forms are secondary here). |
| `StatusBadge` | Every domain status → a consistent badge tone, in one place. |

Each module is then ~3 small files (list, detail, form) plus tiny option/enum
config. All rendering uses **existing `@living/ui`** components — the scaffold
is composition, not new primitives.

---

## 2. Deep-linkable list state

Every list route uses `parseListSearch` as its `validateSearch`, so
`?page=2&q=khan&status=ACTIVE&sort=firstName&dir=asc` fully describes the table.
Reloads and shared links restore the exact view; `useListQuery` reads from the
URL and writes changes back (`replace`, empty values pruned). Search is
debounced (250ms) with an instant-typing local input. Covered by a unit test on
the parser.

---

## 3. The detail experience is primary

Per the brief, detail — not a giant form — is the main UI. Each detail page:
a large header (avatar/mark, title, status badge, permission-gated Edit/Archive),
then grouped read-only sections, with edits happening in a **side drawer**.

- **Residents** — profile, contact, gender/occupation, emergency contact, unit
  assignment (linked), plus placeholder sections for Timeline and Tickets.
- **Staff** — role, department, contact, access (login link), workload placeholder.
- **Vendors** — company/contact, category, service categories, coverage,
  remarks, assigned-work placeholder.
- **Units** — specification (beds/baths/area/parking/ownership), placement
  (phase/block/floor), and the **residents living in the unit** (linked), fetched
  by `unitId`.
- **Community** — the browse-centric overview: statistics row, details, **blocks**
  (click → Units filtered by that block), amenities, documents, location.

Placeholder sections (`PlaceholderSection`) mark data that arrives with future
modules (a resident's tickets, a vendor's assigned work) — calm, never a void.

---

## 4. Data, permissions, responsiveness

- **Data** — everything through `living-sdk` + TanStack Query. No `fetch`. List
  queries, detail `get`s, and relationship fetches (unit → residents, community →
  hierarchy) are all cached; mutations invalidate the relevant keys.
- **Permissions** — create buttons gate on `*:create` via `<Can>`; Edit/Archive
  on `*:update`/`*:delete`. Users never see actions they can't perform.
- **Responsive** — one implementation: the scaffold's table scrolls on mobile,
  filters wrap, detail grids collapse from 3/2 columns to 1. No duplicate layouts.
- **Motion** — page/detail transitions and drawer slide reuse the foundation's
  ≤300ms, reduced-motion-aware library.

---

## 5. Routing

`/community`, `/units`, `/residents`, `/staff`, `/vendors` (lists, with
deep-link search) and `/{module}/$id` (details) are registered under the
authenticated shell; the sidebar gains a **Community** section. `/tickets`,
`/service-requests`, `/work-orders` remain graceful placeholders until their
sprints. Cross-route navigation uses string paths (TanStack's loose fallback),
keeping the route-helper ergonomics without per-route generic wiring.

---

## 6. A note on shared types

Two fields absent from the FS0 `Resident`/`Vendor` types but present on the
backend (`emergencyContact*`, `dateOfBirth`; vendor `addressLine`) were added to
`@living/types`. This is completing an incomplete type against the real API —
additive, non-breaking (backend and other packages still build), not an
architecture change.

---

## 7. Verification performed

- `pnpm --filter @living/portal typecheck` — clean.
- `pnpm --filter @living/portal test` — **11 tests pass** (dashboard derivations
  + list-search parser).
- `pnpm --filter @living/portal build` — production build clean
  (~32 KB CSS / 7.5 KB gzipped, 2249 modules); dev-mode graph resolves.
- `@living/types` typechecks; `resident`, `workforce`, and `api` still build —
  **no regressions**.

Runtime against live data needs the backend up (`infra:up` → migrate → seed) and
`VITE_API_BASE_URL`; the seeded "The Arbour" community, its units, and the demo
resident/vendor/staff drive the screens.

---

## 8. Success criteria

The complete master-data experience of Living: browse, search, filter, sort,
and manage every community, unit, resident, staff member, and vendor from one
cohesive, fast interface — detail-first, permission-aware, deep-linkable, and
built purely by consuming the existing foundation. Adding the next module (or a
sixth master-data type) is a few config-driven files on the same scaffold.
