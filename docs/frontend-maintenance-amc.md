# Frontend Sprint 8 — Preventive Maintenance & AMC Experience

Two first-class operational workspaces in the **portal** — Preventive Maintenance
and AMC Management — surfacing the Sprint 8 & 9 backend engines, plus the
completion of the Sprint 7 asset-detail placeholders with **live** relationship
data. Built entirely on the existing Living frontend; no new UI framework, no
backend changes.

## Shared foundation (reuse, not duplication)

Three small primitives were extracted so all three registers/forms/details share
one implementation:

- `features/shared/register-view.tsx` — the table/card toggle + persisted
  preference (the asset register was refactored onto it).
- `features/shared/tabs.tsx` — the animated tab strip (the asset detail was
  repointed here; the local copy deleted).
- `features/shared/form-kit.tsx` — `FormSection` / `FormGrid` / `SelectField` /
  `TextAreaField` / `CheckboxField` / `FormFooter`, used by the plan and contract
  multi-section forms.

Everything else reuses what already exists: `ListScaffold` + `useListQuery`
(URL-synced search/sort/filter/pagination), the master-data detail primitives,
`DataTable`, `Timeline`, `Sheet`, `Dialog`, the operations `StatusPill` /
`PriorityPill`, TanStack Query, permission guards, and Framer Motion.

## Preventive Maintenance (`/maintenance`)

- **Register** — table + card views; filters for asset, category, frequency,
  active/paused, and upcoming/overdue (the last two translated to the engine's
  `upcoming`/`overdue` params); sort by name, asset, next run, priority; a
  next-run urgency indicator (overdue / due-soon / scheduled).
- **Create** (`/maintenance/new`) — multi-section (General / Asset / Schedule /
  Execution) with realtime validation (required fields, CUSTOM ⇒ cron required,
  end-after-start) and localStorage draft persistence. The schedule section
  swaps interval ↔ cron based on frequency.
- **Detail** (`/maintenance/:id`) — sticky summary (frequency, next/last run,
  status, priority) with **Generate now / Pause · Resume / Edit / Delete**
  actions, and tabs:
  - **Overview** — plan info, schedule, execution, linked asset.
  - **Checklist** — the template with mandatory badges + instructions; managers
    add/remove items (execution is a future sprint).
  - **Runs** — a newest-first timeline (scheduled / generated / skipped /
    failed) with links to each generated work order.
  - **Work orders** — the work orders this plan generated, in the shared table;
    rows open the Work Order module (execution stays there).
  - **History** — a lifecycle timeline from the plan's real timestamps.

## AMC Management (`/amc`)

- **Register** — table + card; filters for vendor, status, coverage type,
  renewal-due (= `RENEWAL_PENDING`) and expiry window; sort by contract, vendor,
  expiry, cost; a renewal/expiry health indicator. Money is rendered with
  `formatMoney` (pinned to `en-IN` grouping — the platform is India-first).
- **Create** (`/amc/new`) — multi-section (General / Vendor / Dates / Financial /
  Contact) with realtime validation and draft persistence. Coverage and SLA are
  managed on the contract page once it exists.
- **Detail** (`/amc/:id`) — sticky summary (vendor, cost, expiry, health) with
  **Renew / Edit / Delete**, and tabs:
  - **Overview** — vendor, number, status, cost, payment frequency, auto-renew,
    reminder, dates, contact; links to the vendor.
  - **Covered assets** — reuses asset badges; rows open the asset; managers
    add/remove coverage.
  - **SLA** — per-priority response / resolution / escalation targets; managers
    add/remove rules.
  - **History** — the contract's audit timeline (created / updated / renewed /
    expired / coverage changes).

Renewal opens a lightweight drawer (new end date + optional revised cost) →
`living.amc.renew`.

## Asset integration — placeholders replaced with live data

The Sprint 7 asset-detail **Relationships** block now shows **live** data
(`useAssetRelations`): the asset's maintenance plans, the AMC contracts covering
it, and its related work orders — each row navigating straight to the right
module. Because the Work Order API has no asset filter, related work orders are
**derived** from the asset's plans' runs (a bounded, cached fan-out) rather than
faked or left as placeholders.

## Cross-cutting

- **Permissions** — every action (create/update/delete, pause/resume, generate,
  renew, coverage/SLA/checklist management) is gated by its RBAC permission via
  `hasPermission` / `<Can>`; unauthorized controls never render.
- **Performance** — all six routes are lazy-loaded (own chunks); TanStack Query
  caching with `keepPreviousData`; URL-driven list state; memoized derivations.
- **Animation / a11y** — Framer Motion page transitions, card hover, tab
  underline, drawers; `role`/`aria-selected` tabs and toggles, focus-visible
  rings, labelled icon buttons.

## Deliberate scope calls

- **PM History** is derived from the plan's real timestamps — the PM engine has
  no separate history endpoint, and Runs already carry the generation log. AMC
  History uses its real `history` endpoint.
- **Related work orders on an asset** are derived from PM runs (no asset filter
  on the WO API) — bounded and honest, not fabricated.
- **Checklist / coverage / SLA** are managed on the detail page (they need the
  parent id), mirroring the Sprint 7 photos/documents flow; the create forms say so.

## Verification

- `pnpm --filter @living/portal typecheck` — clean.
- `pnpm --filter @living/portal test` — **31 tests pass** (8 new: frequency/due
  and money/contract-health helpers).
- `pnpm --filter @living/portal build` — clean; all six routes emit their own chunks.
- All 11 workspace projects typecheck. Not run against a live API.
