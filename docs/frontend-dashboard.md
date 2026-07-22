# Living Platform — Operations Dashboard (Frontend Sprint 1)

The first feature screen, built **entirely on the Sprint 0 foundation** — no
architecture changes, no new shared components, no `fetch`. It's the operational
command center a manager opens every morning: within 5 seconds they see what
needs attention, what changed today, what's overdue, and what to do next.

---

## 1. What it answers (and how each is sourced)

| Question | Section | Source (via `living-sdk`) |
| --- | --- | --- |
| What needs my attention? | Attention Required | derived from ticket/SR/WO windows |
| What changed today? | Recent Activity | item timestamps → grouped Today/Yesterday |
| What's overdue / pending? | Today's Operations (KPIs) | ticket dashboard summary + SR/WO windows |
| How healthy is the community? | Community Health | closure/completion/occupancy rates |
| What's on my plate? | My Work | items I raised + work awaiting my verification |
| What can I do right now? | Quick Actions | permission-gated navigations |

Every number is real — **no fake metrics, no decorative charts**. Where the
backend has an exact aggregate (the ticket dashboard `groupBy`), it's used
directly; service-request and work-order counts are derived from the recent
**operational window** (newest ~100 items) since those engines have no summary
endpoint. That's honest "current operations", and the trade-off is documented
in `derive.ts` with the upgrade path (add summary endpoints if a community's
active volume ever exceeds the window).

---

## 2. Architecture — thin feature on a thick foundation

```
features/dashboard/
  queries.ts    # one useQueries hook — all data via the SDK, parallel, cached
  derive.ts     # PURE functions: KPIs, attention, activity, health, my-work
  derive.test.ts# vitest — 8 tests on the derivations
  dashboard-page.tsx   # composes queries → derivations → sections
  components/   # AnimatedCounter, KpiCard, Section  (feature-local compositions)
  sections/     # hero, quick-actions, todays-operations, attention-required,
                #   recent-activity, community-health, my-work
```

**All display logic is pure** (`derive.ts`) — no React, no SDK — so it's unit
tested in isolation. Components are thin renderers over the derived data.

**Data flows one way**: `useDashboardData(communityId)` runs seven SDK calls in
parallel through `useQueries` (community, ticket dashboard, ticket/SR/WO/resident
windows, occupancy count), so the whole page has a single loading/error surface
and refetches together. **No component calls `fetch`.**

---

## 3. Reuse, not reinvention

Only **existing `@living/ui` components** render the dashboard: `StatCard`
(inside `KpiCard`), `Card`, `Timeline` (Recent Activity), `Badge`, `EmptyState`,
`Skeleton`, `ErrorState`, `PageContainer`, plus `useAuth`/`usePermissions`/`Can`
and the motion library. Three tiny **feature-local compositions** were added
(not duplicates of anything): `AnimatedCounter`, `KpiCard` (StatCard + counter +
link + hover), and `Section`. The Community Health meters are plain token-styled
bars — clearer than a chart for a rate, and the brief bans decorative charts.

A **current-community context** (`features/community`) was added at the app layer
— it resolves the tenant's communities via the SDK, holds the active one
(persisted), and drives the shell's `WorkspaceSwitcher`. Every future
community-scoped feature reads `communityId` from it. This is app state, not a
package/architecture change.

---

## 4. Motion, responsiveness, a11y, performance

- **Motion** (all ≤300ms, `ease-out`): hero reveal, staggered section reveal
  (`listContainer`/`listItem`), KPI count-up (`AnimatedCounter`), card hover-lift,
  press-scale on quick actions. Wrapped in `<MotionConfig reducedMotion="user">`
  so the whole page honours `prefers-reduced-motion`; the counter checks it too.
- **One responsive layout** — a fluid grid (`grid-cols-2 md:grid-cols-3
  xl:grid-cols-4` for KPIs; `lg:grid-cols-2` for the activity/health split). No
  duplicate mobile implementation.
- **Loading** — per-section skeletons sized to their content, so there's **no
  layout shift** when data arrives.
- **Permission-aware** — each KPI, quick action, and My-Work item is gated on the
  backend permission it maps to (`ticket:view`, `workorder:verify`, …). Users
  never see widgets for capabilities they lack.
- **Error / empty** — `ErrorState` with retry; calm empty states everywhere
  ("All clear" for attention, "You're all caught up" for My Work, "No community
  yet" when a tenant has none).
- **Performance** — 7 parallel cached queries (30s stale), route-level splitting,
  intent preloading, memoized derivations. Portal build: **~32 KB CSS / 7 KB
  gzipped**, ~4s.

---

## 5. Routing

`/` now renders the dashboard inside the authenticated shell. The dashboard's
navigation targets (`/tickets`, `/service-requests`, `/work-orders`,
`/residents`) are registered as **graceful placeholders** (a branded
`EmptyState` — "arrives in an upcoming sprint") so every link, quick action, and
command-palette entry is coherent rather than 404-ing. Feature sprints replace
each placeholder with the real screen — no dashboard changes.

---

## 6. Verification performed

- `pnpm --filter @living/portal typecheck` — clean.
- `pnpm --filter @living/portal test` — **8 vitest tests pass** (KPI math incl.
  overdue exclusion of completed WOs, attention grouping, activity bucketing,
  health rates, my-work gating).
- `pnpm --filter @living/portal build` — production build clean, no empty chunks.
- Dev-mode build — runtime module graph resolves.
- `resident`, `workforce`, and the `api` still build — **no regressions**.

Runtime against live data needs the backend up (`infra:up` → migrate → seed) and
`VITE_API_BASE_URL`; sign in as `admin@living.local` / `Living!2024`. The seeded
demo community ("The Arbour") drives the dashboard.

---

## 7. Success criteria

A first-time user lands on a calm, single-screen command center: a warm
greeting, five quick actions, seven live KPIs that count up and click through,
urgency cards that only appear when something's wrong, a today/yesterday
activity feed, health meters, and their own work — each purposeful, fast, and
elegant. **Zero foundation changes** were required; the dashboard is purely a
consumer of Sprint 0.
