# Backend Sprint 9 — AMC Management Engine

The platform's **contractual layer**. An Annual Maintenance Contract (AMC) engine
that records *who* (a vendor) is responsible for maintaining *which* assets,
*until when*, under *what SLA*, at *what cost*. It does **not** execute work
(Work Order Engine), **not** schedule it (Preventive Maintenance), and **not**
own assets — coverage links to an asset by FK, but assets stay independent.

It reuses the whole platform (Asset Engine, Vendor Engine, tenancy, events, audit,
RBAC, pagination/sort/validation, the shared `@nestjs/schedule` registry) and
changes **no existing engine**.

## Domain model

```
AMCContract ──┬─ AMCCoverage   (which assets, coverage terms)   → Asset (FK only)
              ├─ AMCSLARule    (per-priority response/resolution targets)
              └─ AMCHistory    (immutable, append-only contract history)
        │
        └─ vendor → Vendor (FK, Restrict)
```

- **AMCContract** — vendor + term (start/end + `renewalReminderDays`), status,
  `annualCost` (Decimal(14,2)), currency, payment frequency, contacts, `autoRenew`.
  `contractNumber` unique per tenant.
- **AMCCoverage** — one row per (contract, asset): coverage type, response/
  resolution windows, visit cadence, priority. Unique per (contract, asset).
- **AMCSLARule** — one rule per priority: response/resolution/escalation minutes.
- **AMCHistory** — immutable structured events (`CREATED … ASSET_REMOVED`).

The `annualCost` column is a **Decimal**, not a float — money precision is
correct-by-construction. It serializes to a string in JSON; the SDK types it as
`string` (parse before arithmetic).

## Status lifecycle & the daily sweep

`AMCStatus` = `DRAFT → ACTIVE → {EXPIRED, TERMINATED, RENEWAL_PENDING}`. Manual
transitions go through `PATCH` (activate/terminate). Time-based transitions are
handled by **`AmcExpiryService`**, a daily `@Cron` sweep (reusing the scheduler
registry already added in Sprint 8):

- ACTIVE contracts past `endDate` → **EXPIRED** (emits `AMCContractExpired`,
  records history), and
- ACTIVE contracts inside their **per-row** renewal window → **RENEWAL_PENDING**,

both via a compare-and-swap `updateMany` so the sweep is idempotent. The
`renewalDue` list filter then just reads `status = RENEWAL_PENDING` — exact and
cheap, since the sweep maintains it precisely per contract (`isRenewalDue` is pure
and unit-tested). `AMC_EXPIRY_ENABLED=false` disables it on an instance.

Renewal (`POST /amc/contracts/:id/renew`) opens a new term (defaults `startDate`
to the old `endDate`), sets `ACTIVE`, records `RENEWED`, emits
`AMCContractRenewed`.

## Validation

Vendor ownership (vendor is in-tenant **and** covers the community — the same
check the Work Order engine uses for assignment); asset ownership (in the
contract's community); community ownership (`CommunityAccessService`); contract
dates (`endDate` after `startDate`); duplicate contract numbers (per tenant);
coverage duplication (unique per contract+asset); SLA consistency (positive
targets, resolution ≥ response, escalation ≥ response — pure and tested).

## API

| Method | Route | Permission |
| --- | --- | --- |
| GET/POST | `/amc/contracts` | `amc:read` / `amc:create` |
| GET/PATCH/DELETE | `/amc/contracts/:id` | `amc:read` / `:update` / `:delete` |
| POST | `/amc/contracts/:id/renew` | `amc:renew` |
| GET | `/amc/contracts/:id/history` | `amc:read` |
| GET/POST | `/amc/contracts/:id/assets` (+ `DELETE …/:assetId`) | `amc:read` / `amc:coverage:manage` |
| POST | `/amc/contracts/:id/sla` | `amc:sla:manage` |
| PATCH/DELETE | `/amc/sla/:id` | `amc:sla:manage` |

Filters: vendor, status, **expiringBefore** (endDate), **renewalDue** (=
RENEWAL_PENDING), community, coverage type, asset (via coverage). Sort whitelist:
name, vendor, endDate (expiry/renewal), annualCost, createdAt.

## Events, audit & multi-tenancy

Domain events only: `AMCContractCreated`, `AMCContractActivated`,
`AMCContractRenewed`, `AMCContractExpired`, `AMCAssetCovered`, `AMCAssetRemoved`,
`AMCSLAChanged`. API mutations are captured by the global `AuditInterceptor`;
every contract change also appends an immutable `AMCHistory` row. Every contract
carries `tenantId` + `communityId`; all reads/writes route through
`CommunityAccessService.assert`; lists require a `communityId`. Contracts never
leak across communities.

## How it ties the platform together

- **Assets know which contract protects them** — `Asset.amcCoverages` → contract.
- **Preventive Maintenance knows which vendor is responsible** — a PM plan's asset
  resolves its active AMC coverage → vendor.
- **Work Orders can identify whether work is covered** — a generated WO carries
  `assetId` (Sprint 7); an active AMC coverage for that asset means it's covered.
  No WO schema change was needed or made.

## SDK

`living.amc.{list,get,create,update,renew,coverages,addCoverage,removeCoverage,
history,addSla,updateSla,removeSla}`, with `AMCContract`, `AMCCoverage`,
`AMCSLARule`, `AMCHistory` + four enums in `@living/types`.

## Verification

- `prisma validate` + `generate` — clean.
- `nest build` — clean. `eslint --max-warnings 0` — clean.
- Jest — **76 tests pass** (10 new: contract dates, SLA consistency, isExpired,
  isRenewalDue).
- All 11 workspace projects typecheck.
- Migration `20260722020000_sprint9_amc_management` (4 enums, 4 tables). Not run
  against a live DB (no Docker on this host — consistent with Sprints 3–8). The
  daily sweep is gated by `AMC_EXPIRY_ENABLED`.
