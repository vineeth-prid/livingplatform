# Living Platform — Ticket Experience (Frontend Sprint 3)

The flagship operational module: triage, assign, track and close tickets with
minimal effort. Built on the Sprint 0 foundation and the Sprint 2 master-data
scaffold — no architecture changes. Inspired by Linear's calm efficiency, true
to the Living design language.

---

## 1. What shipped

- **List** with **Table ↔ Kanban** toggle (persisted in `localStorage`), search,
  filters (status / priority / category), sorting, pagination, deep-linked state.
- **Kanban** board: tickets grouped into status columns, cards open the detail,
  and a per-card quick-menu moves a ticket to any *valid, permitted* next status.
- **Detail** — the primary experience: header + status menu, conversation-first
  layout (description → comments → attachments) with a context sidebar (details,
  assignment, timeline, related-work placeholder).
- **Create / Edit** in a Sheet drawer, **React Hook Form + Zod**.
- **Assignment** to staff or covering vendors; **comments** with an internal-note
  flag; **attachments** via the StorageService signed-URL flow; **timeline**
  reusing the shared component; **status management** driven by a workflow mirror.

---

## 2. Status workflow — the UI never offers an invalid action

`status-workflow.ts` is a pure client mirror of the backend `TicketStatusService`
(same transition map) plus the permission each transition needs
(`RESOLVED → ticket:resolve`, `CLOSED → ticket:close`, else `ticket:update`).
`allowedStatusActions(from, permissions)` returns only transitions that are both
**valid** and **permitted**, so the status menu and Kanban quick-actions can only
ever show legal moves — the backend never has to reject one. Covered by 5 unit
tests (valid transitions, resolve/close gating, reopen labelling, terminal).

Because the mirror could drift from the backend, the server remains the
authority: an out-of-date client still can't bypass it (the API re-validates and
the mutation surfaces the error calmly).

---

## 3. Optimistic, calm interactions

Status change is **optimistic**: `onMutate` writes the new status into the ticket
cache immediately, `onError` rolls back, `onSettled` refetches — so triage feels
instant. Assignment, comments and attachments invalidate the ticket + list
caches on success. All motion (list stagger, card hover, drawer, timeline reveal)
is ≤300ms and reduced-motion-aware via the foundation's library.

---

## 4. Reuse over duplication

- **List shell**: `ListScaffold` gained one optional prop — `renderContent` — to
  swap the table body for the Kanban board while keeping the *same* search,
  filters, header and deep-link state. No list plumbing duplicated across modules.
- **Detail**: reuses `DetailShell` / `DetailHeader` / `DetailSection` /
  `Field` / `PlaceholderSection` from the master-data scaffold, plus `Timeline`,
  `Avatar`, `Badge`, `DropdownMenu`, `Sheet`, `EmptyState`, `useConfirm`, `toast`.
- **Ticket-specific compositions only** (allowed): status badge + priority badge,
  status menu, assignment control, comment thread, timeline mapper, attachments,
  Kanban, and the RHF form.

---

## 5. Data & permissions

- **Every call goes through `living-sdk` + TanStack Query — no `fetch`.** The
  detail `get` already embeds category/unit/resident/assignee/comments/
  attachments/timeline, so the page is one query plus mutations.
- **Permission-aware throughout**: raise (`ticket:create`), edit (`ticket:update`),
  assign (`ticket:assign`), comment (`ticket:comment`), resolve/close via their
  permissions, delete (`ticket:delete`). Actions the user can't perform are hidden.

---

## 6. Honest boundaries (matching the current API)

- **Unassign** isn't offered — the backend `assign` requires exactly one of
  staff/vendor and has no clear-assignment endpoint. Assign / reassign only.
- **Attachment delete** isn't offered — there's no delete endpoint. List +
  download + add.
- **Attachment bytes** aren't uploaded — StorageService is a metadata-only stub
  this phase; the flow registers the attachment record (signed-URL → metadata)
  and wires the byte PUT in when a real provider lands. Marked with a `ponytail:`
  note.
- **Rich text / mentions** are plain text for now (a documented future
  enhancement); **saved filters** and **bulk selection** are UI-ready foundations
  without persistence/actions yet.

None of these are faked — the UI shows exactly what the platform supports today.

---

## 7. Verification performed

- `pnpm --filter @living/portal typecheck` — clean.
- `pnpm --filter @living/portal test` — **16 tests pass** (dashboard, list-search,
  + 5 status-workflow).
- `pnpm --filter @living/portal build` — production build clean (~33 KB CSS /
  7.6 KB gzipped, 2274 modules); dev-mode graph resolves.
- `resident`, `workforce`, and `api` still build — **no regressions**.

Runtime against live data needs the backend up (`infra:up` → migrate → seed) and
`VITE_API_BASE_URL`; the seeded community, units, categories and people drive the
full triage → assign → comment → resolve → close flow.

---

## 8. Success criteria

A facility manager can scan the board or table, raise a ticket in a drawer,
assign it to the right staff member or vendor, converse in comments, watch the
timeline build, and drive it through its lifecycle — fast, calm, purposeful, and
unmistakably Living. Built entirely by consuming the existing foundation; the
next operations module (Service Requests) is the same pattern on the same
scaffold.
