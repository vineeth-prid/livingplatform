# Living Platform — Operations Execution (Frontend Sprint 4)

Service Requests and Work Orders as **two specialised workflows on one shared
Operations framework** — consistent with the Ticket Experience, execution-
focused, built entirely on the existing foundation. No architecture changes, no
duplicated infrastructure.

---

## 1. One framework, two modules

The mandate — "do not build two independent modules; build one reusable
experience with module-specific behavior" — is met by a shared
`features/operations/` layer that both modules consume, plus a small per-module
**config** and the pieces unique to each workflow.

**Shared (`features/operations/`):**

| Piece | Both modules use it for |
| --- | --- |
| `createWorkflow` | A generic status machine: transition map + permission-per-target + `excludeFromMenu`, yielding only *valid, permitted* next actions. |
| `OperationsStatusMenu` | The status dropdown, driven by any workflow. |
| `OperationsAssignment` + `useAssignees` | Assign / reassign to staff **or** vendor (staff XOR vendor, per backend). |
| `OperationsTimeline` | Structured events → the shared `Timeline` (covers ticket/SR/WO event types). |
| `OperationsKanban` + `ViewToggle` + `useViewMode` | Table ↔ Kanban board with per-card quick-status moves; preference persisted. |
| `StatusPill` / `PriorityPill` | Tone-mapped status/priority badges. |
| `ProgressMeter`, `OpsSelect` | Progress bar; RHF-friendly select. |

**Per module:** a `config.ts` (workflow + tone map + kanban columns + filters),
a list page, an RHF+Zod form, a detail page, and the workflow-specific bits —
**SR:** scheduling + feedback; **WO:** progress updates + verification.

The Ticket module (Sprint 3) keeps its own now-slightly-overlapping helpers to
avoid touching working code; new execution modules use the shared framework, and
tickets could adopt it later with no change to behaviour.

---

## 2. Status workflows mirror the backend exactly

Each module's `config.ts` encodes its backend transition map:

- **Service Requests:** `REQUESTED → ASSIGNED → ACCEPTED → SCHEDULED →
  IN_PROGRESS → COMPLETED` (+ CANCELLED/REJECTED). `COMPLETED` needs
  `service:complete`, `CANCELLED` needs `service:cancel`.
- **Work Orders:** `DRAFT → ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED →
  VERIFIED → CLOSED` (+ ON_HOLD/CANCELLED). `IN_PROGRESS`/`COMPLETED`/`CLOSED`
  need `workorder:start`/`complete`/`close`. **VERIFIED is excluded from the
  status menu** and handled by the dedicated **verify** action (with remarks) —
  enforcing **verify-before-close** (CLOSED is only reachable from VERIFIED).

`createWorkflow` is pure and tested (3 tests: valid/terminal, menu-exclusion,
permission gating). The server remains the authority; the mirror just keeps the
UI from ever offering an illegal move.

---

## 3. Execution-focused detail

Both details are conversation/progress-first with a context sidebar, matching
tickets:

- **Service Request** — description, **scheduling** (preferred + actual start/
  end, inline editor), **feedback** (1–5 stars + comment, only after COMPLETED,
  mirroring the backend rule); sidebar: details, assignment, related-ticket
  placeholder. SR has no comments/attachments/timeline endpoints, so those are a
  single honest **Activity placeholder** (not faked).
- **Work Order** — description, **progress** (latest % as a `ProgressMeter` +
  update history with internal-note flag + composer), **attachments**; sidebar:
  details (estimated/actual hours, origin, dates), assignment, **verification**
  flow, **timeline**, origin placeholder.

Status changes are **optimistic** (cache write → rollback on error → refetch);
assignment/progress/verification/attachments invalidate on success. All motion
≤300ms, reduced-motion-aware.

---

## 4. Honest boundaries (matching today's API)

- **SR:** no comments / attachments / timeline endpoints → a single Activity
  placeholder. No progress-% (SR tracks scheduling, not percentage).
- **WO:** progress updates serve as the activity log (no separate comments). No
  attachment delete (no endpoint). Attachment bytes aren't PUT — StorageService
  is a metadata-only stub; the record is registered and byte upload wires in with
  a real provider (`ponytail:` note).
- **Unassign** isn't offered for either (backend `assign` requires exactly one
  party). Related-ticket / related-work-order links are placeholders where the
  backend has only ids.

Nothing is invented — the UI shows exactly what the platform supports.

---

## 5. Reuse & consistency

Everything else is the existing foundation: `ListScaffold` (with the `renderContent`
override added in Sprint 3 for Kanban), `useListQuery` (deep-linked search/filter/
sort/pagination), `DetailShell`/`DetailHeader`/`DetailSection`/`Field`/
`PlaceholderSection`, the shared `Timeline`, `Sheet`, `DropdownMenu`, `Badge`,
`Avatar`, `EmptyState`, `useConfirm`, `toast`, and the motion library. RHF + Zod
(added in Sprint 3) power both forms via the shared `OpsSelect`.

---

## 6. Verification performed

- `pnpm --filter @living/portal typecheck` — clean.
- `pnpm --filter @living/portal test` — **19 tests pass** (+3 generic workflow).
- `pnpm --filter @living/portal build` — production build clean (~34 KB CSS /
  7.7 KB gzipped, 2298 modules); dev-mode graph resolves.
- `resident`, `workforce`, and `api` still build — **no regressions**.

Runtime against live data needs the backend up (`infra:up` → migrate → seed) and
`VITE_API_BASE_URL`; the seeded services and community drive the full request →
assign → schedule → progress → complete → verify → close flows.

---

## 7. Success criteria

Service Requests and Work Orders feel like two specialised workflows built on the
same premium operational experience — instantly recognisable alongside the Ticket
Experience, but execution-focused (scheduling, feedback, progress, verification).
Built by consuming the existing foundation with one shared framework; the four
operational modules (tickets, SR, WO, + future) now share the same status,
assignment, timeline, kanban and list patterns.
