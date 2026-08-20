# Living — end-to-end application workflows

What each role can do, which app they do it in, and how work moves between
them. This is the functional companion to
[`ARCHITECTURE_OVERVIEW.md`](ARCHITECTURE_OVERVIEW.md), which covers topology
and code structure rather than behaviour.

Everything below reflects what is built and merged. Where a capability exists
but is not yet reachable from a screen, it says so.

---

## 1. The three applications

There is no single "app". Each audience gets a surface shaped for how they work.

| App | Who signs in | Shape | Typical device |
| --- | --- | --- | --- |
| **Portal** (`admin.*`) | Platform Admin, Association Admin, Facility Manager | Dense admin SPA — tables, filters, bulk actions | Desktop |
| **Resident PWA** (`app.*`) | Resident, family members | Installable mobile app | Phone |
| **Workforce PWA** (`gate.*`) | Staff, Security, Vendor | Installable, one-hand, job-at-a-time | Phone at the gate or on site |

One person, one login. A resident who owns flats in two communities signs in
once and switches community in-app; a supervisor covering three does the same.
Each community is its own tenant, and access is carried by per-community role
grants rather than by separate accounts.

---

## 2. Roles at a glance

Seven roles. `SECURITY` is **additive** — a guard is a staff member who also
mans the gate, so they hold both roles and ordinary staff need no exclusions.

| Role | Scope | In one line |
| --- | --- | --- |
| **Platform Admin** | Platform | Runs the product across every customer. Full permissions (`*`). |
| **Association Admin** | Tenant | Runs a customer: every community, user and role inside it. |
| **Facility Manager** | Community | Runs one community day to day. Operations, not commercials. |
| **Resident** | Community | Lives there. Raises requests, books, pays, invites visitors. |
| **Staff** | Community | Works the queues — tickets, service requests, work orders. |
| **Security** | Community | Mans the gate: arrivals, visitors, approvals. |
| **Vendor** | Community | External contractor. Executes assigned work only. |

### The important boundaries

These are the distinctions that decide who can do what, and they are enforced
in the API rather than by hiding buttons:

- **Facility Manager vs Association Admin.** A Facility Manager runs operations
  but holds no billing configuration, no payment settings, no user or role
  administration, and cannot delete units, residents or vendors. Money and
  identity stay with the Association Admin.
- **Staff vs Vendor.** Both execute. Staff may *raise* and *recommend* work
  orders; a vendor may only work ones assigned to them. Neither can approve
  spending, verify completion, or close.
- **Residents hold no gate permission at all.** Everything a resident does with
  their own arrivals goes through self-scoped routes where their unit
  assignment is the authorisation — the same posture as `/residents/me`. That
  is what stops one resident acting on another's flat.
- **Approval is separated from execution** everywhere it involves money: the
  person who recommends a work order is never the person who approves it.

---

## 3. Platform Admin

The control plane, under `/admin/*` in the Portal. Invisible to every other
role.

**Dashboard · Audit & monitoring · System · Notifications · WhatsApp ·
Payments · Business · Community management**

### Onboarding a customer

1. **Provision a community** — creates the tenant, the community and its
   Association Admin atomically, and returns a one-time password.
2. **Hand over credentials.** From Community management → the key icon:
   *Reset and email to admin* issues a fresh temporary password and emails it
   to the admin's own address. It is shown on screen as well, because email can
   bounce and this dialog is the only other place it exists. *Reset without
   email* stays available for when the stored address is wrong.
3. **Log in as admin** — mints a session as that community's Association Admin
   so you can set the community up or reproduce a problem. Your own tokens are
   stashed client-side, a banner shows you are impersonating, and **Exit**
   restores you without re-authenticating. Every impersonated action stays
   attributed to you.

> The existing password can never be displayed — it is an argon2 hash. Reset is
> the only way to issue a working credential.

### Running the platform

- **Business** — customers, communities, adoption of the optional modules.
- **Audit & monitoring** — the audit trail, including impersonation.
- **System** — health of the API and its dependencies.
- **Notifications / WhatsApp / Payments** — provider configuration, WhatsApp
  session pairing (QR), and payment rail status.

---

## 4. Association Admin — the community's operator

The whole Portal except `/admin/*`. Six groups:

### Community
`Community · Units · Residents · Staff · Vendors · Settings`

**Setting up the physical community.** Blocks → floors → units, then residents
into units. Units can be created one at a time or by **CSV bulk upload**; the
importer creates missing floors automatically (named `Level <n>`) but never
invents a block or phase — those must exist first. The upload drawer lists the
exact rules and the accepted values for every enum column.

**People.** Residents, staff and vendors each get a login provisioned from
their **mobile number**, which becomes the username, plus a one-time password
they must change at first sign-in. Key rules:

- A number identifies a person. The same number in a *different* community
  reuses their existing login — one human, one identity. The same number for a
  *different* person in the *same* community is rejected.
- **One resident per unit**, plus their household. Family members are added
  *under* that resident rather than as second occupants.
- **Staff must be given at least one category** — that is what routes work to
  them. Without it they match nothing and everything falls to manual assignment.
- **Vendors must cover at least one community**, or they are invisible to
  assignment everywhere.

### Operations
`Tickets · Service requests · Work orders · Assets · Maintenance · AMC`

Covered as flows in §8.

### Billing
`Collection · Maintenance charges · Payment settings · Notifications`

Per-property-type charges, invoice generation with a **preview before commit**,
a collection dashboard, and two Razorpay rails per community (stored encrypted).
Notification routing is per community and per event.

### Catalog
`Services · Categories · Packages`

The service catalog a resident sees. A community **owns its own catalog**:
platform-provided services can be renamed, repriced or withdrawn for that
community alone without affecting anyone else. Every service carries a price
(use `0` for free) — packages sum them to show the advertised saving.

### Community ops
`Visitors · Gate · Gate analytics · Amenities · Bookings · Documents ·
Announcements`

### Optional modules

Two capabilities are per-community toggles: **maintenance billing** and
**service packages**. When off, the routes return 404 rather than 403 — the
feature does not exist for that community rather than being forbidden.

---

## 5. Resident — the PWA

`Home · Requests · Services · Amenities · Bookings · Visitors · Gate ·
Maintenance · My packages · Announcements · Community · Profile`

### Raising something

One sheet, two outcomes:

- **Ticket** — something is broken. Goes to the community's queue and is
  auto-assigned by category.
- **Service request** — something the community sells (deep clean, plumbing
  visit). Priced, optionally with variants (car size, apartment size) and a
  quantity.

The resident sees their own history under **Requests**, whose "All" tab merges
tickets, service requests and any work orders raised against their flat.

### Booking an amenity

Browse bookable amenities → pick a date and time. The app checks the rules the
resident can already see — opening hours, maximum duration — before the
round-trip, and the API enforces all of them again, including slot capacity.
**Opening hours are evaluated in the community's timezone**, not the server's.

### Visitors and the gate

- **Invite a visitor** for one of *their own* flats, with an expected arrival
  time. This creates a gate entry and issues a **pass code**. Security sees it
  immediately; either Security or an admin can approve or reject it.
- **Arrivals** — when a delivery or visitor reaches the gate, the resident gets
  a push/in-app/WhatsApp/email notification and can **approve or reject from
  their phone**. If no channel reaches them, the guard's screen says so and
  falls back to a phone call.
- Cancelled and rejected visits stay in the list as history.

### Money

**Maintenance** shows dues and pays them through Razorpay. **My packages**
shows purchased service packages and the balance remaining, which is derived
from the requests actually used rather than stored as a counter.

---

## 6. Staff — the Workforce PWA

`Today · Jobs · Job detail · Gate (if Security) · Activity · Profile`

Built for one hand, on site, on a mid-range Android.

### Working a job

1. **Today** — what is assigned to you now.
2. Open the job → **before photos**. A `BEFORE` photo is **required to start**.
3. Start work, post progress and comments.
4. **After photos** — an `AFTER` photo is **required to complete**.
5. Complete. Verification and closure belong to a manager.

Photos are downscaled on the device before upload (a 9 MB camera frame becomes
roughly 300 KB), uploaded to storage first and registered second, so a record
never exists without the object behind it. Any photo can be removed and retaken.

### Raising a work order

Staff can **raise or recommend** a work order from a job when a fix needs paid
work. Recommending parks the originating ticket — leaving it `IN_PROGRESS`
would tell the resident somebody is working when nobody can — and either
decision releases it again.

---

## 7. Security — the gate console

Everything Staff has, plus **Gate**.

The gate register shows **today's arrivals**, meaning entries created today *or
expected today* — a visit invited last week for this afternoon appears on the
right day. Grouped as **Waiting on resident → Approved, hand over → Closed**,
and kept live over SSE rather than polling.

**Logging an arrival:** search the unit → record who is at the gate (delivery
brand, person, vehicle, photo) → the resident is notified automatically. The
guard can see the resident's name and mobile for that one unit *without*
holding `resident:read`, which would expose the whole register.

**Visitors** invited by residents appear here already marked with their pass
code and expected time. Security or an admin can approve or reject; the
decision is immediately true in both places.

---

## 8. Vendor

Vendors sign in to the Workforce PWA and see **only work assigned to them**:
tickets, service requests and work orders they are executing.

A vendor may update, start and complete. A vendor **cannot** create or approve
work orders, verify completion, or close anything. Auto-assignment picks the
least-loaded vendor whose categories match and who covers that community.

---

## 9. The core flows, end to end

### Ticket — something is broken

```
Resident/Admin raises  →  OPEN
        ↓ auto-assign by category (staff first, then vendor; never blocks)
      ASSIGNED  →  IN_PROGRESS  →  RESOLVED  →  CLOSED
                        ↓ needs paid work
                   ON_HOLD ──────────────→ (work order approved/rejected) ──→ IN_PROGRESS
```

A `BEFORE` photo gates starting; an `AFTER` photo gates resolving.

### Service request — something the community sells

```
Resident requests  →  REQUESTED
        ↓ auto-assign to a matching vendor
   ASSIGNED → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED
```

Resident feedback closes the loop. A request can be linked to, or converted
into, a ticket when it turns out to be a repair.

### Work order — approved work, and the money question

```
                  recommend                     approve
Ticket / PM / staff ─────────→ PENDING_APPROVAL ────────→ APPROVED
                                      │ reject                │ auto-assign vendor
                                      ↓                       ↓
                                  REJECTED               ASSIGNED → ACCEPTED
                                                              ↓
    Emergency (skips approval) → DRAFT ────────────────→ IN_PROGRESS → COMPLETED
                                                              ↓
                                                        VERIFIED → CLOSED
```

**Approval is where the work becomes real**, so it is also where a vendor is
found: auto-assignment fires on approval, not on recommendation, because
assigning a vendor to spending nobody has agreed to is wrong. Rejection is a
decision about the *spending*, never about the problem — the originating ticket
resumes and staff carry on without the paid work.

### Preventive maintenance and AMC

A maintenance plan against an asset generates work **recommendations** on
schedule (never executable work directly), which a manager approves. AMC
contracts track coverage, SLAs and renewals against the same assets.

### Gate arrival

```
Guard logs arrival  ─┐
                     ├→ CREATED → (notify resident) → NOTIFIED → APPROVED → COMPLETED
Resident invites  ───┘                                    ↓
                                                      REJECTED / CANCELLED
```

Notification fans out across in-app, push, WhatsApp and email according to the
community's routing. If every channel fails, the entry stays `CREATED` and is
flagged so the guard calls instead.

### Billing

```
Charges per property type → generate invoices (preview first) → ISSUED
        ↓ resident pays (Razorpay)                    ↓ overdue sweep
     PARTIALLY_PAID / PAID                          OVERDUE
```

### Service packages

A package bundles catalog services at a discount. Purchase → payment succeeds →
`ACTIVE`. The remaining balance is **derived from the service requests actually
raised against it**, so it can never drift from reality.

---

## 10. What is not built yet

Stated plainly so nobody looks for it:

- **No SR → work order button.** Work orders can be raised from tickets and
  from maintenance plans; there is no equivalent action on a service request.
- **No head count on amenity bookings.** Capacity is concurrent bookings per
  slot, not people per booking.
- **Community banner images** are stored by key; there is no upload control on
  the settings screen yet.
- **RLS is staged but inert.** Tenant isolation is enforced in the application
  today; the database policies exist as defence in depth and are not active.
- **Check-in / check-out for visitors** collapsed into `COMPLETED` when
  visitors moved onto the gate engine.

---

## 11. Where to read more

| Topic | Document |
| --- | --- |
| Topology, engines, request lifecycle | [`ARCHITECTURE_OVERVIEW.md`](ARCHITECTURE_OVERVIEW.md) |
| Sign-in, OTP reset, password rules | [`authentication.md`](authentication.md) |
| Notification events and routing | [`notification-triggers.md`](notification-triggers.md) |
| Razorpay rails and webhooks | [`payments.md`](payments.md) |
| Packages and balance derivation | [`service-packages.md`](service-packages.md) |
| Per-community settings and toggles | [`community-settings.md`](community-settings.md) |
| Deploying, migrations, env vars | [`DEPLOYMENT.md`](DEPLOYMENT.md), [`DEPLOY_2026-08-10.md`](DEPLOY_2026-08-10.md) |
| Installing the PWAs | [`pwa-installation.md`](pwa-installation.md) |
