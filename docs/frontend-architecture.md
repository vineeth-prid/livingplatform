# Living Platform — Frontend Architecture (Product Experience Foundation)

This is the foundation the entire Living frontend is built on. It ships **no
business screens** — its job is that every future feature sprint (dashboard,
tickets, residents, service requests, work orders) is built *entirely by
consuming this foundation*, changing none of it.

The backend (Sprints 1–6) is production-ready and unmodified; the frontend only
consumes its REST API via a typed SDK.

---

## 1. Monorepo shape

```
apps/
  api/            # backend (untouched)
  portal/         # admin/ops web app — the fully-wired REFERENCE app
  resident/       # resident app — thin scaffold reusing the shared foundation
  workforce/      # staff/vendor field app — thin scaffold
packages/
  config/         # shared tsconfig bases
  design-system/  # Living tokens, fonts, Tailwind preset, ThemeProvider
  ui/             # component library + motion + providers + app shell
  living-sdk/     # typed client wrapping every backend endpoint
  hooks/          # query client, SDK provider, auth + permission framework
  types/          # shared API + domain types
  utils/          # cn(), formatters, small helpers
```

**Why one shell, three apps.** The brief lists three apps *and* demands "no
duplicate components / reused by every module." Those reconcile as: **all UI
lives in `@living/ui`**, and each app is a thin composition of it. `portal` is
wired end-to-end (auth, guards, router, shell, command palette); `resident` and
`workforce` are runnable scaffolds that import the same `@living/design-system`
and `@living/ui` — proving reuse without duplicating a line of UI. Feature
sprints flesh out each app's screens from the shared library.

---

## 2. The layered dependency graph

```
types  ─┐
utils  ─┤→ living-sdk ─→ hooks ─→ ui ─→ apps
        │                  ↑        ↑
design-system ─────────────┘────────┘
```

Strictly one-directional. `types`/`utils` are leaves; `living-sdk` depends only
on `types`; `hooks` wires the SDK into React Query + auth; `ui` composes
everything into components and the shell; apps compose `ui`. No cycles.

---

## 3. Living SDK — no `fetch()` in components

`packages/living-sdk` is the single boundary to the backend. Components never
call `fetch`; they call typed resource methods:

```ts
living.auth.login({ email, password })
living.ticket.list(communityId, { status: 'OPEN' })
living.workOrder.verify(id, 'Checked on site')
living.serviceRequest.submitFeedback(id, { rating: 5 })
```

- **`HttpClient`** is the one place a network call happens. It attaches the
  bearer token, **transparently refreshes on 401** (single-flight, retries the
  request once), unwraps the `{ success, data }` envelope, and normalizes every
  error to `LivingApiError`.
- **Resources** (`auth`, `community`, `people`, `ticket`, `serviceRequest`,
  `workOrder`, `platform`) mirror the backend engines one-to-one and are fully
  typed against `@living/types`.
- **Token storage is pluggable** (`TokenStore`) — localStorage in the browser,
  in-memory for SSR/tests. **The same SDK will back future mobile apps.**

---

## 4. Auth & permission framework

`packages/hooks` provides the authorization spine:

- **`AuthProvider` / `useAuth`** — session identity from `/auth/me`;
  roles/permissions **decoded from the access token** (which already carries the
  flattened permission set the backend embeds), so permission checks are
  synchronous and local — no request per check.
- **`<Can perm="ticket:create">…</Can>`** and `usePermissions()` — declarative UI
  gating that mirrors the backend's permission catalog exactly.
- **Route guards** (`RequireAuth`, `RequirePermission`) in the portal redirect or
  fall back based on the same session.
- On a failed refresh the SDK's `onUnauthorized` bounces to `/login`.

Because the backend authorizes independently, the frontend gating is purely UX —
it never becomes the security boundary.

---

## 5. Data layer

TanStack Query, configured once in `createQueryClient()`:

- **never retries 4xx** (deterministic), retries 5xx twice;
- `refetchOnWindowFocus: false` for a calm feel;
- a central **query-key factory** (`qk`) so cache invalidation stays consistent
  as feature sprints add hooks.

Optimistic updates, virtualization and prefetch (`defaultPreload: 'intent'` on
the router) are wired at the foundation level for feature sprints to lean on.

---

## 6. Design system — reused, not re-invented

`packages/design-system` carries the **Living brand tokens** (Pine/Stone/Clay,
Cormorant/Schibsted/IBM Plex, radius, warm shadows, 8-pt spacing) as CSS
variables, in light and dark, plus:

- a **Tailwind preset** mapping every token to utilities (`bg-brand`,
  `text-muted`, `rounded-card`, `shadow-md`) that theme-switch automatically;
- a **`ThemeProvider`** that resolves light/dark/system, persists the choice, and
  stamps `<html data-theme>` — components need no per-theme code;
- **reduced-motion** honoured at the token layer (durations collapse to 0).

Layouts and page composition are **new** (per the brief) — only the design
*language* is inherited.

---

## 7. Component library (`@living/ui`)

Hand-authored on **Radix primitives + CVA + Living tokens** (shadcn-style, but
on-brand from line one — no re-skinning). Grouped:

- **Primitives**: Button, Input, Card, Badge, Avatar, Skeleton, Spinner.
- **Overlays**: Dialog, Sheet/Drawer, DropdownMenu, Tooltip — Radix handles
  focus-trapping, escape and ARIA; **Framer** supplies calm enter/exit motion.
- **Data**: Table, DataTable (loading skeletons + empty state built in),
  Pagination, StatCard, Timeline, ChartWrapper.
- **Search/filters**: SearchInput, FilterBar, FilterSelect.
- **States**: EmptyState, LoadingState, ErrorState.
- **Providers**: Toast (sonner), Confirm dialog (imperative `useConfirm()`),
  ErrorBoundary, and the global **Command Palette** (⌘K, cmdk, register actions
  from anywhere).
- **Shell**: `AppShell` (responsive sidebar↔drawer + sticky header from one
  component), Sidebar, Header, WorkspaceSwitcher, ProfileMenu, ThemeSwitch,
  PageContainer/PageHeader/PageTransition.

All shell pieces are **router-agnostic** — links/crumbs are rendered via
callbacks, so the portal uses TanStack Router while the package stays neutral.

---

## 8. Motion system

One library (`@living/ui/motion`): `fade`, `fadeRise`, `dialogContent`, `scrim`,
`drawer(side)`, `listContainer`/`listItem`, `press`, with token-matched durations
and easings. Every consumer pairs it with `useReducedMotion()` via `reduce()`,
and Framer also respects the OS setting. Motion improves usability (context,
focus, feedback) — never decorates.

---

## 9. Responsiveness & accessibility

- **One component per concept** across desktop/tablet/mobile/large monitors —
  `AppShell` swaps a fixed sidebar for an animated drawer via `useIsDesktop()`,
  no duplicate layouts.
- WCAG AA tokens (contrast-checked Pine/Stone), a calm 3px focus ring on every
  focusable, Radix focus-trapping in overlays, ARIA on shell controls, and
  reduced-motion throughout.

---

## 10. Performance

- **Route-level code splitting** (TanStack Router) + intent preloading.
- **Vendor chunking** (router/query/motion split) — verified in the build.
- Query caching, `refetchOnWindowFocus` off, and a foundation ready for
  optimistic updates and table virtualization.
- Portal production build: **~30 KB CSS (7 KB gzipped)**, chunked JS, builds in
  ~4s.

---

## 11. Verification performed

- `pnpm install` across the workspace — clean.
- **Typecheck**: all 6 source packages + all 3 apps pass `tsc --noEmit`.
- **Production build**: `portal`, `resident` and `workforce` all build with Vite
  (2214 / 2118 modules), no errors, no empty chunks.
- The portal wires the full stack end-to-end: providers → SDK → auth → guards →
  shell → routes (login, foundation home, component showcase, 404).

Runtime against the live API needs the backend running (`docker compose up` +
migrate + seed) and `VITE_API_BASE_URL` set; the login screen then authenticates
against the seeded `admin@living.local`.

---

## 12. How feature sprints consume this

A future "Tickets" screen is: a route under the portal's dashboard layout, a
`useQuery` calling `living.ticket.list(cid, params)`, rendering `<DataTable>` with
`<Badge>` status cells, a `<Can perm="ticket:create">` new-ticket button opening
a `<Sheet>` form, and `toast`/`useConfirm` for feedback. **Zero foundation
changes** — which is the entire success criterion of this sprint.
