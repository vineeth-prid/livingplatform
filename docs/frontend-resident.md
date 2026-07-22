# Living Platform — Resident Experience (Frontend Sprint 5, PWA)

A consumer-grade **Progressive Web App** for residents — not a reduced admin
portal. Warm, calm, one-handed, installable, offline-ready. Built as the
`apps/resident` app on the **same shared packages** as the portal (SDK, design
system, UI, motion, hooks) — no architecture changes.

---

## 1. What shipped

- **Mobile shell** — a max-width, safe-area-aware app frame with a fixed
  **bottom tab bar**: Home · Services · Requests · Community · Profile. One
  responsive layout (centred + framed on tablet/desktop).
- **Home** — greeting + community, open-requests preview, quick actions, recent
  activity, and honest placeholders for announcements + upcoming bookings.
- **Services** — browse the community's service catalogue; tap a service to
  request it in a bottom sheet.
- **Requests** — the resident's own tickets + service requests, merged and
  filterable (all / complaints / services), with a detail screen (status,
  description, timeline, and a resident-safe message thread for complaints).
- **Community** — amenities, emergency contacts (tap to call), documents; the
  residents directory is **permission-gated** (`resident:read`) so ordinary
  residents never see it.
- **Profile** — identity, theme switch, sign-out, and placeholders for linked
  units / family / notifications.
- **PWA** — web manifest, installable icon, and a Workbox service worker
  precaching the app shell (7 entries) for an offline-ready start.

---

## 2. Consumer, not enterprise

The whole experience is re-composed for residents, not a stripped admin UI:

- **Bottom navigation**, large touch targets (≥44–56px), minimal typing,
  tap-to-call contacts, and a **bottom sheet** (`Sheet side="bottom"`) for the
  one form residents use — raising a complaint or requesting a service.
- Calm consumer status tones (an active request reads *friendly*, not alarming),
  warm greetings, `Living.` wordmark, and page-fade transitions (≤300ms,
  reduced-motion-aware).
- It reuses the shared `@living/ui` (Card, Badge, Avatar, **Timeline**, Sheet,
  Button, Input, EmptyState, Skeleton, toast, useConfirm), the `@living/hooks`
  auth/query/permissions, the motion library, and the SDK — with small
  resident-local compositions (`StatusPill`, `QuickAction`, `ListCard`,
  `MobileShell`) for the consumer feel.

---

## 3. Data — SDK only, filtered to *me*

Everything goes through `living-sdk` + TanStack Query; **no `fetch`**. Since the
backend has no "my resident record" endpoint yet, the app:

- resolves the resident's **community** from the tenant's community list (their
  tenant is their community), and
- builds **"My requests"** by fetching the recent tickets/service requests and
  keeping only those this user raised (`reportedById` / `requestedById === me`).

Create flows (complaint → ticket, request → service request) use **React Hook
Form + Zod** in the bottom sheet, with a unit + category/service picker.

---

## 4. Honest boundaries (matching today's API)

- **Linked units / family members** — no self-record endpoint exists, so the
  resident's unit isn't auto-resolved (they pick their unit when raising a
  request); these are calm placeholders that auto-fill once the backend exposes
  the resident's own record.
- **Announcements, upcoming bookings, notifications** — no backend yet →
  friendly placeholders (never faked data).
- **Residents directory** — hidden unless the user holds `resident:read`
  (ordinary residents don't).
- Internal comments are never shown to residents (the message thread filters
  them out, matching the backend's visibility rule).

Nothing is invented — the app shows exactly what the platform supports.

---

## 5. Accessibility & performance

- Large touch targets, `aria-current` on the active tab, screen-reader labels,
  keyboard-operable controls, and reduced-motion honoured throughout.
- Route-level preloading, skeleton loading, query caching, optimistic-friendly
  mutations, and a precached shell for fast (and offline) startup.
- Theme-aware (the resident's own light/dark/system choice, persisted).

---

## 6. Verification performed

- `pnpm --filter @living/resident typecheck` — clean.
- `pnpm --filter @living/resident build` — production build clean; **PWA
  artefacts generated** (`sw.js`, `workbox-*.js`, `manifest.webmanifest`,
  `registerSW.js`; 7 precached entries).
- `@living/types` typechecks; `portal` (19 tests), `workforce`, and `api` still
  build — **no regressions** (the only shared change was completing the
  `Community` type with fields the backend already returns).

Runtime needs the backend up (`infra:up` → migrate → seed) and
`VITE_API_BASE_URL`; any resident-capable account signs in (the seeded
`admin@living.local` works for a demo). Installable from the browser's "Add to
Home Screen".

---

## 7. Success criteria

Living feels like a modern lifestyle app for residents — calm, premium,
effortless, one-handed — not a management tool. It reuses the existing platform
completely (SDK, design system, UI, motion, hooks) with zero architectural
changes, and every screen consumes only what the backend genuinely offers today.
