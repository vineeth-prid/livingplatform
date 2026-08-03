# Community settings & module toggles

Sprint 12. Not every association hands the same responsibilities to Living, so
the optional modules are per-community configuration rather than platform-wide
assumptions.

Portal → **Community → Settings**.

---

## 1. The toggles

| Setting | Default | Off means |
| --- | --- | --- |
| `maintenanceBillingEnabled` | `true` | No rate cards, no invoice generation, no maintenance payments, and no maintenance surface in the portal or the resident app. |
| `servicePackagesEnabled` | `true` | No package catalog, no purchases, no packages in the resident app. |

**Both default to ON.** A community that predates this sprint has no settings
row at all, and `SettingsService.features()` returns the defaults for it — which
is what makes the change non-breaking. Turning a module off is a deliberate act.

---

## 2. One source of truth

```ts
SettingsService.features(communityId)          // { maintenanceBilling, servicePackages }
SettingsService.assertMaintenanceBillingEnabled(communityId)
SettingsService.assertServicePackagesEnabled(communityId)
SettingsService.maintenanceEnabledByCommunity(ids)   // bulk, for dashboards
```

`SettingsModule` is **global** precisely so billing, payments, packages and the
dashboards all read the same answer. A toggle honoured in one code path and
ignored in another is worse than no toggle at all.

### Enforcement

| Layer | How |
| --- | --- |
| API — whole controllers | `@RequireCommunityModule('maintenanceBilling')` at the **class** level on both billing controllers, checked by the global `ModuleEnabledGuard`. A route added there later is covered automatically. |
| API — payments | `PaymentService.createCheckout` asserts before opening a **new** maintenance checkout. |
| API — scheduler | The nightly billing sweep filters to communities with the module on, so no late fees or reminders reach a community that does not use Living for collection. |
| Frontends | `useCommunityFeatures(communityId)` from `@living/hooks` — the portal drops the nav items, the resident app hides the maintenance card, tab and menu entries. |

> **404, not 403.** For a community with the module off, those endpoints
> genuinely do not exist. A 403 would confirm the feature is merely switched off
> and invite probing — this matches how cross-tenant ids already return 404.

> **Settlement is never gated.** Turning the module off blocks *new* checkouts;
> a payment already in flight still settles through the webhook. Switching off a
> module must never strand a resident's money.

### Frontend usage

```tsx
const features = useCommunityFeatures(communityId);
if (!features.maintenanceBilling) return <NotCollectedHere />;
```

The hook defaults to ON while loading — briefly showing a module and then hiding
it is a much smaller sin than hiding a community's billing on every slow network.

---

## 3. Resident home banners

`homeBanners` is an array on the settings document:

```jsonc
{
  "id": "diwali-offer",          // stable — used as the React key
  "title": "20% off deep cleaning",
  "subtitle": "Book before the 30th",
  "imageKey": "banners/diwali.jpg",  // storage key, never a raw URL
  "actionUrl": "/services",          // in-app route
  "kind": "ad",                      // "ad" | "announcement"
  "sortOrder": 0
}
```

The resident hero merges these with **live published announcements**, which come
first — an urgent notice surfaces without anyone editing settings. The carousel
rotates every 6 seconds, respects `prefers-reduced-motion`, and renders nothing
at all when there is neither an announcement nor a configured slide.

Max 12 slides (`ArrayMaxSize`).

---

## 4. Platform visibility

Platform Admin sees whether each community collects through Living:

```
GET /api/v1/admin/stats/maintenance-enabled   → [{ communityId, enabled }]
GET /api/v1/admin/stats/business              → aggregate counts
```

Yes/no only — see [`dashboards.md`](dashboards.md).

---

## 5. Testing

```bash
cd apps/api && npx jest src/modules/settings
```

Covers both toggles on/off, the no-settings-row default, 404-not-403 assertion
behaviour, and the bulk lookup filling in defaults for unconfigured communities.
