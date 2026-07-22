# Frontend Sprint 6 — Workforce Experience (Staff & Vendor PWA)

The field-execution app. Where the portal administers work and the resident app
requests it, **workforce is where work gets done** — by maintenance staff,
security, housekeeping, electricians, plumbers and external vendors, on a phone,
often on a patchy connection. The whole design optimises for *execution speed*:
the fewest taps between "open the app" and "job moved forward".

It is the third app on the shared foundation (`apps/workforce`), built exactly
like the resident PWA — same provider stack, same shared packages, **no
architectural changes, no new frameworks, no duplicated infrastructure.**

## What it reuses (everything)

- **Living SDK** (`@living/living-sdk`) — every read/write. No component calls `fetch`.
- **`@living/hooks`** — `createQueryClient`, `LivingProvider`, `AuthProvider`
  (permissions decoded from the JWT), media queries.
- **`@living/ui`** — Button, Card, Badge, Avatar, SearchInput, EmptyState,
  LoadingState, Timeline, Toast, Confirm, Skeleton — the same components the
  portal and resident apps use.
- **`@living/design-system`** — Living tokens (light + dark), Tailwind preset, ThemeProvider.
- **Framer Motion** — page fades, card tap feedback, all ≤ 300 ms, reduced-motion aware.

Because packages can't cross the app boundary, the portal's `features/operations`
framework is **mirrored, not imported** — the same established constraint the
resident app hit (FS5). The mirror is deliberately *smaller*: workers only need a
handful of execution verbs, so `execution.ts` is a compact, worker-focused
subset of the three backend status services rather than the full admin workflow.

## Structure

```
apps/workforce/src/
├─ main.tsx / providers.tsx / router.tsx   # same bootstrap as resident
├─ shell.tsx           # mobile shell, bottom nav, offline banner, ScreenHeader
├─ worker.tsx          # WorkerProvider — resolves my staff/vendor identity
├─ jobs.ts             # useMyJobs (unify WO/SR/tickets) + detail/status hooks
├─ execution.ts        # PURE worker workflow (accept/start/pause/complete/…) + tests
├─ offline.ts          # online status + Query-cache persistence
├─ components.tsx      # JobCard, StatusPill, PriorityPill, Section, ProfileNotLinked
├─ detail-panels.tsx   # progress, notes, photo capture, timeline panels
└─ screens/            # login, today, jobs, job-detail, activity, profile
```

## Navigation — job-first

Bottom tab bar, four destinations:

- **Today** — the day at a glance: resume in-progress work, then priority /
  overdue / today / upcoming, ordered so the next tap is always the most urgent job.
- **Jobs** — the full queue. Search + status segment (active/done/all) + kind
  chips (work orders / services / tickets) + a priority toggle, over a responsive
  card grid (one column on a phone, two on a tablet).
- **Activity** — a personal work log: what's in flight, what was recently completed.
- **Profile** — identity, role (staff role or vendor category), assigned
  community, theme, sign out.

## The core problem: "which jobs are mine?"

Jobs are assigned to a **Staff** or **Vendor** (`assignedStaffId` /
`assignedVendorId`), never directly to a `User`. There is no `/me/assignments`
endpoint and no `assignedToMe` list filter. So `WorkerProvider` resolves identity
by matching the logged-in user's id against the linked `userId` on the
community's staff and the tenant's vendors, then `useMyJobs` pulls the recent
window from each of the three engines and keeps only rows assigned to that
staff/vendor id (the same client-side approach the resident app uses for "my
requests").

If nothing matches — account not linked, or no read grant — the app shows a
clear **"account not linked"** state rather than a silent empty queue.

> **Known ceiling** (`ponytail:` in `worker.tsx` / `jobs.ts`): O(n) scan of the
> staff/vendor lists + a recent-100 window per engine + a single active
> community. Replace with a backend `/me/assignments` endpoint (or an
> `assignedToMe` filter) and multi-community support when they land — only those
> two files change.

## Execution — respecting the backend workflows

`execution.ts` is a **pure, tested** mirror of the three backend status services
(`TicketStatusService`, `ServiceRequestStatusService`, `WorkOrderStatusService`),
narrowed to the moves a field worker makes: **accept, start, pause, resume,
complete, resolve, reject**. Admin-only transitions (assign, schedule, verify,
close, cancel, draft) are never offered here.

`workerActions(kind, status, permissions)` returns the valid **and** permitted
next moves, best action first — so the app never shows a button the backend would
reject, and the single most important move is rendered as the big primary CTA on
the job detail screen. Optimistic status changes (write-through cache with
rollback on error) keep the UI instant. Verify-before-close is respected:
completing a work order shows a read-only *"awaiting verification"* note; the
worker never sees a verify or close button. Covered by 9 unit tests.

## Job detail — the primary experience

Everything about one job on a single screen, execution actions at the top:

- Header (kind, number, status, priority) → **primary + secondary action
  buttons** → description → details (location, resident, assignee, hours, due /
  preferred date).
- **Progress** (work orders): a meter + update history + composer (% + internal note).
- **Notes** (tickets): the worker's public/internal comment log.
- **Photos** (work orders + tickets): "Take photo" (opens the camera via
  `capture="environment"`) and "Upload" (gallery), staged thumbnails, then
  registered through the StorageService signed-URL flow.
- **Timeline** (work orders + tickets): the structured event log.
- **Feedback** (service requests, display-only): the resident's rating once completed.

Service requests have no comments / attachments / timeline endpoints, so those
sections are omitted for that kind (same as the portal).

> **Photo bytes** (`ponytail:` in `detail-panels.tsx`): storage is still the
> metadata-only stub, so photos register the record without the byte PUT —
> exactly the portal's behaviour. When a real provider lands, add the
> `fetch(uploadUrl, { method: 'PUT', body: file })` step; nothing else changes.

## Offline readiness

Three pieces, **no new dependency** (`offline.ts` + the PWA config):

1. **Shell precache** — `vite-plugin-pwa` (Workbox `autoUpdate`) precaches the
   app shell so it opens on a job site with no signal.
2. **Data precache** — the TanStack Query cache is mirrored to `localStorage`
   (dehydrate on change, hydrate on boot, capped at a day) so a worker who opens
   the app offline still sees their last-synced jobs.
3. **Queued writes** — handled by TanStack Query itself: mutations fired offline
   pause and auto-resume on reconnect, and status changes are already optimistic,
   so the UI stays responsive. A persistent **offline banner** reassures rather
   than blocks.

> **Ceiling** (`ponytail:` in `offline.ts`): a whole-cache localStorage snapshot,
> hydrated once. Swap for `@tanstack/query-persist-client` + a durable
> mutation-resume queue if multi-tab sync or offline writes-that-survive-reload
> are ever needed — the seam is that one module.

## Accessibility & performance

- Large touch targets (job cards ≥ 76 px, action buttons `size="lg"`, tab
  targets ≥ 56 px), high-contrast tokens, `aria-current` / `role` on nav and filters.
- Reduced-motion respected everywhere; all motion ≤ 300 ms.
- Lazy routes — Today + login load eagerly; Jobs, Job detail (with its
  photo/progress panels), Activity and Profile code-split into their own chunks.
- Skeleton loading, optimistic updates, `defaultPreload: 'intent'`.

## Verification

- `pnpm --filter @living/workforce typecheck` — clean.
- `pnpm --filter @living/workforce test` — **9 tests** (execution workflow) pass.
- `pnpm --filter @living/workforce build` — clean, PWA generated (sw.js +
  workbox + manifest, 12 precache entries).
- All 10 other workspace projects still typecheck. Not run against a live API
  (needs the backend up).
