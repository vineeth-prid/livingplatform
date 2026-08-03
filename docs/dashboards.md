# Dashboards & business intelligence

Sprint 12. Two scopes, one hard rule between them.

> **The platform operator never sees a community's financials.**
> `CommunityInsightsService` is tenant-scoped and answers only for the caller's
> own community. `PlatformBusinessService` returns counts of communities and
> sums across *all* of them — nothing in its response can be attributed back to
> a single association.

---

## 1. Community dashboard

Portal → **Dashboard**, "Business" section
(`GET /communities/:id/insights`, permission `insights:read`).

| Metric | Notes |
| --- | --- |
| Maintenance collected / outstanding | **`null` when the module is off** — the card reads "Not enabled", not a misleading `₹0`. |
| Service collected | Paid SERVICE-rail payments. |
| Package revenue | Included in service collected, not added twice. |
| Residents using services | Distinct residents with ≥1 service request, plus adoption %. |
| Requests (30 days) | Recent demand. |
| Most booked service | Name + booking count. |
| Most booked package | Name + purchase count. |
| Top vendors | Top 5 by completed work, with their open load. |

Every read goes through `CommunityAccessService.assert`, so cross-community
access is impossible regardless of the caller's permissions.

---

## 2. Platform dashboard

Portal → **Platform admin → Business**
(`GET /admin/stats/business`, gated on `community:create` — platform only).

| Group | Contents |
| --- | --- |
| Communities | Total, active, **maintenance enabled / disabled**, packages enabled |
| Adoption | Communities collecting, publishing packages, selling packages, with % |
| Popular services | Top 5 by bookings, platform-wide |
| Popular packages | Top 5 by purchases, **merged by name** across communities |
| Revenue | Total collected, average per community, last 30 days, previous 30 days, growth % |

Two deliberate choices:

- **Packages merge by name.** Several communities may run a package called
  "3 Month Home Care"; merging keeps this an aggregate rather than a
  per-community leaderboard.
- **Growth is `null`, not `0%`, with no prior period.** "We have no comparison"
  and "we grew 0%" are different facts.

`GET /admin/stats/maintenance-enabled` returns `[{ communityId, enabled }]` —
a yes/no flag per community and nothing else.

---

## 3. Where the numbers come from

All live reads; no materialised aggregates and no cron. Costs are bounded by
`groupBy` + `aggregate` rather than row scans.

| Figure | Source |
| --- | --- |
| Collections | `payments` where `status = PAID` |
| Outstanding | `maintenance_invoices` sum(total) − sum(paid), excluding CANCELLED |
| Package revenue | `service_package_purchases` in ACTIVE/COMPLETED |
| Adoption | `distinct` on residents / communities |
| Vendor performance | `service_requests` grouped by `assignedVendorId` |

> `ponytail:` these are computed per request. If a dashboard ever gets slow,
> cache the platform aggregate in Redis for a few minutes — the community one is
> already narrow enough not to need it.

---

## 4. Automatic vendor assignment (Feature 4)

Feeds the "Top vendors" numbers, and worth knowing when reading them.

When a **ticket** or **service request** is created, the system picks a vendor:

1. category matches the vendor's `category` or one of `serviceCategories`
   (case- and separator-insensitive — `Plumbing_Services` matches `plumbing services`)
2. the vendor covers this community (`communityIds`)
3. the vendor is ACTIVE and not deleted
4. of those, the **least open workload** (open tickets + open service requests),
   ties broken by name so the choice is deterministic

No match → left unassigned for a community admin. **Assignment never blocks
creation**: the whole attempt is wrapped in a catch, so a failure loses the
assignment, never the ticket.

Auto-assigned rows carry `autoAssigned = true` and a null `assignedById`, so a
manager can tell "the system routed this" from "a person chose this" — and from
"nobody has looked at it". Work Orders keep their existing manual flow.

```bash
cd apps/api && npx jest src/modules/vendor
```

Covers primary/secondary category matching, normalisation, least-workload
selection across both work types, deterministic tie-breaks, and the
no-match/no-category/no-vendor cases.
