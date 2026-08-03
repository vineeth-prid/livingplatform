# Service Packages

Sprint 12. A package is a priced **bundle of services that already exist in the
Service catalog** — sold through the existing Payment Engine and delivered
through the existing Service Request Engine.

**There is no package engine.** That is the whole design.

---

## 1. What was NOT built

| Tempting | Why it was rejected |
| --- | --- |
| A separate package "catalog" of services | A package holds `serviceId` references. A service deactivated in the catalog is unavailable everywhere at once, and a package can never advertise something the community cannot deliver. |
| A package payment flow | Buying opens the same Razorpay checkout on the same SERVICE rail. `packagePurchaseId` is just another checkout target next to `invoiceId` and `serviceRequestId`. |
| A package booking engine | Redeeming creates an ordinary `ServiceRequest`. It appears in "My requests", gets auto vendor assignment, and follows the normal status workflow and notifications. |
| A redemption counter | Remaining balance is **derived** by counting the service requests a purchase produced. Nothing can drift out of sync, and cancelling a request returns the entitlement automatically. |

---

## 2. Model

```
ServicePackage ──1:N── ServicePackageItem ──→ Service   (existing catalog row)
       │
       └──1:N── ServicePackagePurchase ──(paymentId)──→ Payment  (SERVICE rail)
                          ▲
                          └── ServiceRequest.packagePurchaseId   (redemptions)
```

| Model | Notes |
| --- | --- |
| `ServicePackage` | Community-scoped. Price, `listPrice`, `durationDays`, `propertyTypes[]`, ACTIVE/INACTIVE. |
| `ServicePackageItem` | One catalog service + `quantity` + frozen `unitPrice`. Unique per (package, service). |
| `ServicePackagePurchase` | PENDING → ACTIVE → COMPLETED / EXPIRED. Carries a JSON `snapshot` of what was bought. |

`ServiceRequest.packagePurchaseId` is a plain scalar with **no FK** — the same
pattern as the existing `ticketId` link — so the Service Request Engine stays
independent of the packages feature.

### Pricing and savings

`listPrice` = Σ (item quantity × `Service.basePrice`), computed and **frozen at
save time**. Re-pricing a service later never silently rewrites the saving a
resident was shown when they bought.

If *any* member service has no `basePrice`, `listPrice` is `null` and no saving
is advertised — a partial sum would be misleading. A package priced above list
shows a saving of `0`, never a negative one.

---

## 3. Lifecycle

### Community admin — Portal → **Catalog → Packages**

| Action | Behaviour |
| --- | --- |
| Create / Edit | Items are replaced wholesale (a small, fully-specified list); every service is validated against the community's catalog. |
| Enable / Disable | The supported way to withdraw a package. |
| **Duplicate** | Copies items and pricing as an **INACTIVE** draft, so duplicating never accidentally publishes a half-edited offer. |
| Delete | Only while it has never been purchased — otherwise deactivate. |

### Resident — PWA → **Services**

Packages render **before** individual services. Package detail shows the
included services, the saving, the validity window and one Buy button.

```
Buy
 → POST …/packages/purchase              (PENDING purchase, server-priced)
 → POST …/payments/checkout              ({ purpose: SERVICE, packagePurchaseId })
 → Razorpay Checkout
 → POST …/payments/verify
 → payment.succeeded domain event
 → purchase becomes ACTIVE, validUntil = now + durationDays
```

The packages module listens for `payment.succeeded` rather than being called by
the payment module, so **the payment engine knows nothing about packages**.
Activation is idempotent, so the checkout-callback/webhook race is harmless here
too.

### Redemption — PWA → **Profile → My packages**

Each entitlement shows `remaining of total`. "Book" creates a normal
ServiceRequest carrying `packagePurchaseId`. When every entitlement is spent the
purchase flips to COMPLETED.

`ServiceRequestService.create` takes the package link as a **separate `internal`
parameter**, not a DTO field — a resident cannot forge a redemption by posting
one.

---

## 4. API

| Route | Permission |
| --- | --- |
| `GET /communities/:id/packages` | `package:read` |
| `GET /communities/:id/packages/available` | `package:read` |
| `POST/PUT/PATCH/DELETE /communities/:id/packages…` | `package:manage` |
| `POST /communities/:id/packages/:id/duplicate` | `package:manage` |
| `POST /communities/:id/packages/purchase` | `package:purchase` |
| `GET /communities/:id/package-purchases` | `package:read` (residents see only their own) |
| `POST /communities/:id/package-purchases/:id/redeem` | `service:create` |

Every route is gated on the community's `servicePackages` module toggle.

---

## 5. Service availability (Feature 2)

Related, and the reason packages stay honest: a service is **enabled or
disabled**, never deleted.

```
PATCH /services/:id/status   { isActive }     (service:catalog:manage)
GET   /services/:id/usage                     → { openRequests, packages }
```

An inactive service:

- disappears from the resident app (`activeOnly`)
- can no longer be requested (`assertUsable` requires `isActive`)
- keeps every historical request intact
- does not disturb in-flight work

Portal → **Catalog → Services** shows an Active/Inactive switch and no delete
button. Deactivating asks for confirmation and reports how many open requests
and packages reference the service first.

A package whose services have *all* been deactivated stops being offered to
residents.

---

## 6. Testing

```bash
cd apps/api && npx jest src/modules/packages
```

Covers list-price computation, explicit unit-price override, the unpriced-service
case, the never-negative saving, duplicate service rejection, and cross-tenant
service rejection.
