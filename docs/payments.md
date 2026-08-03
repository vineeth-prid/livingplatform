# Payments & Maintenance Billing

Sprint 11. Two independent Razorpay rails per community, configurable
maintenance charges, invoice generation, and one transaction history.

There is exactly **one** payment implementation on the platform
(`apps/api/src/modules/payments`). Nothing else talks to a gateway.

---

## 1. Model

```
Community ──1:2── CommunityPaymentConfig   (purpose = MAINTENANCE | SERVICE)
Community ──1:N── MaintenanceCharge        (rate card, per property type, effective-dated)
Community ──1:N── MaintenanceInvoice       (one unit, one period)
Community ──1:N── Payment                  (every collection attempt, both rails)
```

| Module | Owns |
| --- | --- |
| `modules/billing` | Rate cards, invoice generation, late fees, dashboards, resident dues. **No gateway code.** |
| `modules/payments` | Gateway credentials, checkout, signature verification, webhooks, refunds. Depends on `billing`, never the reverse. |

> The existing `modules/maintenance` is the **Preventive Maintenance engine**
> (assets, plans, runs). The money side of "maintenance charges" is
> `modules/billing`. Two bounded contexts, no rival models.

Money is `Decimal(14,2)` in rupees everywhere, matching the Work Order and AMC
cost columns. Services convert to `number` at the API boundary so clients never
receive Decimal strings.

---

## 2. Community Razorpay configuration (Feature 2)

Every community configures **two separate Razorpay accounts**:

| Rail | Collects |
| --- | --- |
| `MAINTENANCE` | Monthly / quarterly / yearly maintenance charges |
| `SERVICE` | Paid service requests |

Accounts are community-specific and never shared. A signature minted with one
community's key secret fails verification against another's — that is the
mechanism, not a policy.

### Secrets

`keySecret` and `webhookSecret` are encrypted with **AES-256-GCM**
(`common/crypto/secret-cipher.ts`) before they touch the database, using
`APP_ENCRYPTION_KEY`. They are:

- decrypted **only** inside `PaymentConfigService`, only to hand to `RazorpayClient`
- **never** in any API response — `GET` returns `hasKeySecret: boolean` and a
  masked key id
- **never** in a domain event or audit payload

Stored form is `v1:<iv>:<tag>:<ciphertext>` (base64url), so the scheme is
rotatable.

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /communities/:id/payment-config` | `payment:config:read` | Both rails, status only |
| `PUT /communities/:id/payment-config/:purpose` | `payment:config:update` | Omit a secret to keep the stored one |
| `POST /communities/:id/payment-config/:purpose/verify` | `payment:config:update` | Live credential check, throttled |
| `GET /admin/payment-config` | `community:create` (platform) | Readiness across communities — **status only** |

**Super Admin sees configuration status only.** There is no route that returns a
community's credentials to anyone.

### Razorpay setup

1. Razorpay Dashboard → **Settings → API Keys** → generate a key pair.
2. Portal → **Billing → Payment settings** → paste Key ID + Key Secret for the rail.
3. Razorpay Dashboard → **Settings → Webhooks** → add:

   ```
   https://<api-host>/api/v1/payments/webhooks/razorpay/<communityId>/<PURPOSE>
   ```

   Events: `payment.captured`, `order.paid`, `payment.failed`.
   Set the webhook secret, and paste the same value into the portal.
4. Hit **Test connection**. Flip **Mode** to `LIVE` when the test keys pass.

---

## 3. Maintenance charges (Feature 3)

Rate cards are keyed on the community's **own** property types — the same
free-form `Unit.type` values ("1 BHK", "2 BHK", "Villa", "Commercial", …).
Nothing is hardcoded; `GET …/maintenance-charges/property-types` returns the
types that community actually has, with unit counts.

Each rate carries:

| Field | Meaning |
| --- | --- |
| `monthlyAmount` | Required |
| `quarterlyAmount` / `yearlyAmount` | Optional — derive as ×3 / ×12 when unset (so annual discounts are expressible) |
| `lateFeeAmount` | Flat late fee |
| `lateFeePercent` | Percentage of the bill |
| `gracePeriodDays` | Days after the due date before a late fee applies |
| `effectiveFrom` / `effectiveTo` | Effective dating |

**A rate revision is a NEW row with a later `effectiveFrom`, never an edit.**
`chargeInForce()` picks the latest row effective on or before the period start,
so a future-dated row takes over automatically when that period is billed, and
invoices already issued keep the rate that produced them.

---

## 4. Billing & collection (Feature 4)

### Generation

`POST /communities/:id/maintenance-invoices/generate`

```jsonc
{ "cycle": "MONTHLY", "periodDate": "2026-08-01", "dueDay": 10, "dryRun": true }
```

- Periods align to the calendar (month / Jan-Mar quarters / calendar year).
- **Idempotent** on `(unitId, cycle, periodStart)` — a unique index plus
  `skipDuplicates`, so re-running a month never double-bills, even concurrently.
- Units whose property type has no rate in force are reported as `unpriced`
  with the missing types listed, rather than being silently skipped.
- `dryRun: true` computes the run and writes nothing.

### Late fees

Recomputed lazily on read/refresh rather than by a nightly mutation, so a bill
is always correct as of *now*. The nightly sweep
(`BillingSchedulerService`, `BILLING_SWEEP_ENABLED`) applies them across every
active community and queues `MAINTENANCE_DUE` reminders through the
Notification Engine.

### Payment flow

```
Resident taps Pay
  → POST …/payments/checkout        (server derives the amount from the invoice balance)
  → Razorpay order created with the COMMUNITY's key
  → Razorpay Checkout opens in the PWA
  → POST …/payments/verify          (HMAC over order|payment with the community key secret)
  → settle(): Payment → PAID, invoice credited, receipt number minted
```

Two things make this safe:

- **The client never sends a trusted amount.** For maintenance it is derived
  from the invoice balance; a client-supplied amount is clamped to it.
- **Settlement is idempotent.** `settle()` short-circuits when the payment is
  already `PAID`, so the checkout callback and the webhook racing each other
  cannot double-credit an invoice. A user who closes the sheet mid-payment is
  still credited by the webhook.

Offline collections (cash / cheque / NEFT / UPI) write the same `Payment` row
via `POST …/maintenance-invoices/:id/record-payment`, so the dashboard and
transaction history stay complete.

### Surfaces

| Who | Where |
| --- | --- |
| Community Admin | Portal → **Billing → Collection** — KPIs, monthly trend, and three tabs: **Invoices**, **Residents** (per-unit payment standing), **Transactions**. Record offline payments from the invoice row. |
| Community Admin | Portal → **Billing → Maintenance charges** |
| Community Admin | Portal → **Billing → Payment settings** |
| Platform Admin | Portal → **Platform admin → Payments** — readiness per community, **status only** |
| Resident | PWA → **Maintenance** (current due, next due, invoices, pay, history, receipt) |
| Resident | PWA → Home shows outstanding dues first, and only when there are any |

Receipts render client-side into a print window — the browser saves them as PDF.
No PDF service was added for one document.

---

## 5. Permissions

| Permission | Association Admin | Facility Manager | Resident |
| --- | :-: | :-: | :-: |
| `payment:config:read` / `:update` | ✓ | — | — |
| `billing:charge:read` | ✓ | ✓ | — |
| `billing:charge:manage` | ✓ | — | — |
| `billing:invoice:read` | ✓ | ✓ | ✓ (own only) |
| `billing:invoice:generate` / `:update` | ✓ | ✓ | — |
| `billing:dashboard:read` | ✓ | ✓ | — |
| `payment:read` | ✓ | ✓ | ✓ (own only) |
| `payment:create` | ✓ | — | ✓ |
| `payment:refund` | ✓ | — | — |

Gateway credentials stay with the Association Admin; the Facility Manager runs
collection day to day but cannot touch keys.

"Own only" is enforced in `InvoiceService` / `PaymentService` by resolving the
caller's resident ids, not by the permission alone.

---

## 6. Testing

```bash
cd apps/api && npx jest src/modules/billing src/modules/payments src/common/crypto
```

Covers: period alignment (incl. leap February and December rollover), cycle
pricing and derivation, due-date clamping, late-fee grace boundaries,
effective-dated rate selection, checkout + webhook signature verification
(including cross-community rejection and body tampering), and cipher
round-trip / tamper / wrong-key behaviour.
