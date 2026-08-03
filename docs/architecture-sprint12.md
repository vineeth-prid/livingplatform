# Sprint 12 — Module toggles, service availability, resident home, auto-assignment, packages, dashboards

**Enhancement sprint.** No architecture change, no redesign, no new engine, no
duplicate UI or API. Everything extends what already exists.

Detail: [`community-settings.md`](community-settings.md) ·
[`service-packages.md`](service-packages.md) · [`dashboards.md`](dashboards.md)

---

## 1. What changed, and what it reused

| Feature | Reused | Added |
| --- | --- | --- |
| 1 · Maintenance toggle | `CommunitySettings`, guard chain | 2 columns, one `ModuleEnabledGuard` |
| 2 · Service availability | `Service.isActive` (already existed) | status route, usage probe, portal page |
| 3 · Resident home | Existing cards, motion, Section/QuickAction | Hero banner component |
| 4 · Auto vendor assignment | Ticket + SR engines, Vendor model | `VendorAutoAssignService` |
| 5 · Service packages | Service catalog, Payment Engine, SR Engine | 3 models, no new engine |
| 6 · Dashboards | `platform-stats` module | 2 read-model services |

One migration: `20260804000000_modules_packages_autoassign`, purely additive.
**Every new column defaults to today's behaviour** — `maintenanceBillingEnabled`
and `servicePackagesEnabled` default to `true`, so no community loses a surface
when this deploys.

---

## 2. The three decisions worth remembering

### Module gating belongs at the controller, not the call site

`InvoiceService` and `MaintenanceChargeService` have 15 `access.assert` call
sites between them. Checking the toggle at each one is 15 chances to forget it
on endpoint 16. Instead:

```ts
@RequireCommunityModule('maintenanceBilling')
@Controller('communities/:communityId/maintenance-invoices')
```

Class-level, enforced by a global guard. Every current *and future* route on
those controllers is covered.

### Remaining package balance is derived, never counted

A redemption creates a `ServiceRequest` carrying `packagePurchaseId`. Remaining
= `item.quantity − count(requests)`. There is no counter column, so nothing can
drift, and cancelling a request returns the entitlement for free.

### The payment engine must not learn about packages

Purchases activate off the existing `payment.succeeded` **domain event**, not a
call from `PaymentsModule`. The only concession in the payment module is writing
`paymentId` onto the purchase row — a plain column write, not a dependency.

Direction of dependencies stays acyclic:

```
packages → service-request → vendor
packages → (event) ← payments → billing
```

---

## 3. Schema

| Model / column | Purpose |
| --- | --- |
| `CommunitySettings.maintenanceBillingEnabled` | Feature 1 toggle (default `true`) |
| `CommunitySettings.servicePackagesEnabled` | Feature 5 toggle (default `true`) |
| `CommunitySettings.homeBanners` | Feature 3 configurable slides |
| `Service.basePrice` | List price — prices packages and shows savings |
| `Ticket.autoAssigned`, `ServiceRequest.autoAssigned` | Feature 4 provenance |
| `ServiceRequest.packagePurchaseId` | Redemption link (scalar, no FK) |
| `ServicePackage` / `ServicePackageItem` / `ServicePackagePurchase` | Feature 5 |

RLS policies for the two new community-scoped tables follow the same staged
(inert until `FORCE`) pattern as previous sprints.

---

## 4. RBAC

```
service:catalog:read     service:catalog:manage
package:read             package:manage            package:purchase
insights:read
```

Association Admin and Facility Manager get catalog + packages + insights;
Resident gets `service:catalog:read`, `package:read`, `package:purchase`.

**Reseed required** (`pnpm db:seed`).

---

## 5. Invariants

| Invariant | Enforced by |
| --- | --- |
| A disabled module has no reachable API | Class-level `@RequireCommunityModule` + global guard |
| Disabling billing never strands in-flight money | Only `createCheckout` is gated; settlement is not |
| A community with no settings row keeps every module | `features()` defaults, covered by test |
| A withdrawn service loses no history | Status flag, never deletion |
| A package can only sell what the catalog offers | Items are `serviceId` references, validated per tenant |
| An advertised saving cannot go stale | `listPrice` frozen at save time |
| A resident cannot forge a redemption | `packagePurchaseId` is an internal parameter, not a DTO field |
| Auto-assignment never blocks creation | Whole attempt wrapped in a catch, returns null |
| The platform operator sees no community's books | Separate services; platform figures are counts or all-community sums |

---

## 6. Verification

```bash
cd apps/api      && npx jest        # 228 tests (was 204)
cd apps/portal   && npx vitest run  #  31
cd apps/resident && npx vitest run  #  12
```

Typecheck, lint (`--max-warnings 0`) and production builds clean across all ten
packages. No existing test changed.

Pending before deploy: `prisma migrate deploy` (3 migrations outstanding) and a
reseed for the new permissions.
