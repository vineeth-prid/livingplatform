# Sprint 11 — Payments, Maintenance Billing, Auth hardening, OpenWA, PWA install

**Additive sprint.** No architecture change, no refactor, no duplicate module.
Everything reuses the existing tenancy guard, RBAC, audit, domain events, SDK,
Storage abstraction, Notification abstraction and Design System.

---

## 1. What was added

| Feature | Where | Reuses |
| --- | --- | --- |
| 1 · Resident PWA installability | `apps/resident/src/pwa`, `scripts/generate-icons.mjs` | Existing `vite-plugin-pwa` service worker |
| 2 · Community Razorpay configuration | `modules/payments` | `CommunityAccessService`, RBAC, audit |
| 3 · Maintenance charge configuration | `modules/billing` | `Unit.type` as the property-type source |
| 4 · Maintenance billing & collection | `modules/billing` + `modules/payments` | Domain events, cron registry, `Paginated` |
| 5 · Mobile-number auth | `modules/auth` | Existing JWT/refresh architecture, `VerificationToken` |
| 6 · OpenWA WhatsApp | `notifications/channels/whatsapp` | **The whole Notification Engine** — one new provider |

Detail: [`payments.md`](payments.md) · [`authentication.md`](authentication.md)
· [`whatsapp.md`](whatsapp.md) · [`pwa-installation.md`](pwa-installation.md)

---

## 2. New bounded contexts

```
modules/billing     money side of maintenance — rate cards, invoices, dashboards
modules/payments    gateway side — credentials, checkout, webhooks, refunds
```

`payments` → depends on → `billing`. Never the reverse.

> **Naming, deliberately:** the existing `modules/maintenance` is the
> **Preventive Maintenance engine** (assets, plans, runs, checklists). Calling
> the billing module `maintenance` would have created two rival meanings for one
> word inside the same codebase, so the money side is `billing`.

### New models

| Model | Purpose |
| --- | --- |
| `CommunityPaymentConfig` | One Razorpay account per (community, purpose). Secrets AES-256-GCM encrypted. |
| `MaintenanceCharge` | Effective-dated rate card per property type. |
| `MaintenanceInvoice` | One unit, one period. Unique on `(unitId, cycle, periodStart)`. |
| `Payment` | Every collection attempt, both rails, one transaction history. |
| `PasswordHistory` | Password reuse prevention. |
| `WhatsAppSession` | The platform's handle on a gateway session. |
| `CommunityNotificationPreference` | Per-community, per-event channel routing. |
| `CommunityNotificationTemplate` | Per-community message wording. |

One migration: `20260803000000_payments_billing_whatsapp`. Purely additive — no
existing table or column is altered. RLS policies for the new community-scoped
tables follow the same staged (inert until `FORCE`) pattern as
`20260727000000_tenant_rls`.

> That earlier RLS migration referenced `tenant_id` / `community_id` in
> snake_case, but Prisma's columns are camelCase — it would have failed at
> `CREATE POLICY`. Fixed in place (quoted identifiers) since it had not been
> applied yet; without it neither migration could deploy.

---

## 3. Cross-cutting additions

### `SecretCipher` (`common/crypto`)

The one place the platform encrypts secrets at rest — AES-256-GCM, random nonce
per encryption, stored as `v1:<iv>:<tag>:<ciphertext>`. Global module, so
payment configuration and the WhatsApp session manager share one key.

A missing `APP_ENCRYPTION_KEY` fails the *operation*, not boot.

### `NotificationRouterService`

The seam that turns a **domain event** into **notifications**:

```
Business module → DomainEvent → NotificationRouter → (per-community preference)
                                                   → NotificationDispatcher → channels
```

Business modules still publish plain domain events and know nothing about
channels. Adding a channel changes nothing here; adding an event is one row in
`EVENT_MAP` plus a `.hbs` template. Every failure is swallowed and logged — a
notification never breaks the transaction that triggered it.

### `EmailTemplateEngine.renderRaw`

Renders a community's own template body with the same helpers, partials, layout
and locale table as a built-in template, so an override behaves identically to
the default it replaces.

---

## 4. Invariants worth keeping

| Invariant | Enforced by |
| --- | --- |
| Gateway secrets never leave the server | `PaymentConfigService` — `status()` is the only read shape |
| One community's keys cannot settle another's payment | HMAC verified with that community's own key secret |
| An invoice is credited exactly once | `settle()` short-circuits on `PAID`, inside a transaction |
| Re-running a billing period never double-bills | Unique `(unitId, cycle, periodStart)` + `skipDuplicates` |
| Rate history is never rewritten | Revisions are new effective-dated rows |
| Residents see only their own money | Resident-id scoping in `InvoiceService` / `PaymentService`, not the permission alone |
| Every password write goes through policy | `PasswordPolicyService.hashAndRecord` is the only writer |
| A 6-digit OTP is not brute-forceable | Redis attempt counter, burned after 5, fails closed |
| WhatsApp survives an API restart | The gateway owns the socket; the API holds only a row |

---

## 5. RBAC

New permissions (seed source of truth, `rbac.constants.ts`):

```
payment:config:read      payment:config:update
billing:charge:read      billing:charge:manage
billing:invoice:read     billing:invoice:generate    billing:invoice:update
billing:dashboard:read
payment:read             payment:create              payment:refund
notification:preference:read     notification:preference:update
notification:template:read       notification:template:manage
whatsapp:admin
```

`PERMISSION_CATALOG` now splits `resource:action:qualifier` keys correctly
(first segment is the resource, the remainder the action).

Grants: Association Admin gets everything including gateway credentials;
Facility Manager runs collection but **cannot** touch keys; Resident gets
read + pay, scoped to their own records.

**Reseed required** (`pnpm db:seed`) for the new permissions and role grants.

---

## 6. Verification

```bash
cd apps/api      && npx jest          # 204 tests
cd apps/resident && npx vitest run    #  12 tests
```

| Layer | Command |
| --- | --- |
| Typecheck | `npx tsc --noEmit` in every package |
| Lint | `npx eslint src --max-warnings 0` |
| API build | `npx nest build` |
| Frontends | `npx tsc -b && npx vite build` |

Pending before deploy: `prisma migrate deploy` (2 migrations) and a reseed.
