# WhatsApp (OpenWA) — Notification Engine channel

WhatsApp is **not** a messaging system. It is a delivery channel inside the
existing Notification Engine, exactly like email:

```
Business module → DomainEvent
                   ↓
        NotificationRouterService     ← per-community preferences decide the channels
                   ↓
          NotificationDispatcher      ← ONE queue, ONE retry policy, ONE delivery ledger
                   ↓
        ChannelRouter → EmailChannel | WhatsAppChannel
                                          ↓
                          WhatsAppProviderFactory → MetaCloudProvider | OpenWaProvider
```

Adding OpenWA changed **one case** in `WhatsAppProviderFactory`. The dispatcher,
queue, retry, delivery tracking and metrics are untouched.

---

## 1. Providers

| `WHATSAPP_PROVIDER` | Provider | Auth | Templates |
| --- | --- | --- | --- |
| `meta` (default) | Meta Cloud API | Business access token | Meta-approved templates |
| `openwa` | Self-hosted [OpenWA](https://github.com/rmyndharis/OpenWA) gateway | QR pairing + `X-API-Key` | None needed — sends as a real number |

Both implement the same `WhatsAppProvider` interface, so switching is one env
var. Where OpenWA has no equivalent of a Meta concept it degrades **honestly**:
a `sendTemplate` call flattens the template's body parameters into text (an
unofficial gateway sends from a real phone and has no template registry), and a
contact card becomes readable text.

---

## 2. OpenWA setup

### Run the gateway

```bash
git clone https://github.com/rmyndharis/OpenWA && cd OpenWA
docker compose up -d
# Swagger: http://localhost:3000/api/docs
```

Create a **session-scoped, non-admin API key** (`OPERATOR` role at most) in the
OpenWA dashboard — not the admin key.

### Point Living at it

```dotenv
WHATSAPP_PROVIDER=openwa
OPENWA_BASE_URL=http://openwa:3000
OPENWA_API_KEY=<session-scoped operator key>
OPENWA_SESSION=living
OPENWA_WEBHOOK_SECRET=<openssl rand -base64 32>
OPENWA_WEBHOOK_URL=http://api:4000/api/v1/notifications/webhooks/openwa
OPENWA_AUTO_RECONNECT=true
OPENWA_HEALTH_INTERVAL_SEC=60
OPENWA_DEFAULT_COUNTRY_CODE=91
APP_ENCRYPTION_KEY=<required to store per-session API keys>
```

`OPENWA_WEBHOOK_URL` is explicit configuration, not derived — the gateway
normally reaches the API on an internal address no public URL can be guessed
from. Leave it empty and the platform skips webhook registration and relies on
the status watchdog instead.

### Pair the session

Portal → **Platform admin → WhatsApp**:

1. **Connect** — creates + starts the session on the gateway.
2. **Show QR** — scan from WhatsApp → *Linked devices → Link a device*. The QR
   rotates; the panel polls every 8s.
3. Status flips to **connected** and the phone number appears.

---

## 3. Connection management

`WhatsAppSessionService` owns the platform's *view* of the gateway. The gateway
owns the actual WhatsApp socket and its credential store — which is precisely
what makes session persistence work across API restarts: nothing is held in
memory here.

| Capability | How |
| --- | --- |
| Connection manager | `connect` / `reconnect` / `disconnect` against the gateway |
| QR authentication | `GET …/sessions/:name/qr`, persisted as `lastQr` until connected |
| Reconnect | Manual, plus automatic when the watchdog sees a drop (`OPENWA_AUTO_RECONNECT`) |
| Health status | Watchdog polls every `OPENWA_HEALTH_INTERVAL_SEC`; `ChannelHealth` feeds `/notifications/channels` |
| Session persistence | `whatsapp_sessions` row; per-session API key AES-256-GCM encrypted |
| Message queue | The **shared** BullMQ notification queue — not a WhatsApp-specific one |
| Retry | The engine's existing backoff (1m, 5m, 15m, 1h → dead letter) |
| Delivery / failure status | Gateway acks map onto `NotificationDelivery` (`SENT → DELIVERED → READ`, or `FAILED`) |

Every connect/drop transition publishes a domain event, so the audit trail shows
exactly when the platform's WhatsApp went down.

### Webhook

`POST /api/v1/notifications/webhooks/openwa`

- Public (the gateway has no JWT). **The HMAC signature is the authentication**,
  verified over the raw bytes with `OPENWA_WEBHOOK_SECRET`.
- With no secret configured the endpoint **rejects everything** rather than
  trusting an unauthenticated caller.
- Handles `session.status` (connection state) and `message.ack` / `message.status`
  (delivery receipts).

---

## 4. Platform Admin — WhatsApp settings

Portal → **Platform admin → WhatsApp**. Configuration and health only:

- Active provider, default sender, rate limit
- Gateway base URL, session name, auto-reconnect, health interval, webhook status
- Session list with status, phone, last connected / last dropped, last error
- QR code, Connect / Reconnect / Disconnect
- Queue depth, retrying and dead-lettered counts
- **Templates** — the platform default catalogue (read-only; per-community
  wording lives on the community admin's screen)
- **Logs** — the 25 most recent WhatsApp deliveries with status and retry count
- Delivery statistics (24h)

**No message can be composed here.** The single send is the explicitly
diagnostic, rate-limited test message.

API keys and webhook secrets are never returned by any of these routes.

---

## 5. Community Admin — preferences & templates

Portal → **Billing → Notifications**
(`/communities/:id/notification-preferences`).

One row per event, one toggle per channel (Email / WhatsApp / both). A community
that has never touched a row runs on the platform default — email on, WhatsApp
following the existing `CommunitySettings.whatsappEnabled` toggle — so nothing
changed for any community until an admin opts in, and adding a new event needs
no data migration.

Message bodies can be overridden per event **and** per channel
(`CommunityNotificationTemplate`), rendered by the same Handlebars engine with
the same helpers, partials and locale table as the built-in templates. Deleting
an override falls back to the platform default.

### Events

| Event | Default template |
| --- | --- |
| `MAINTENANCE_DUE` | `maintenance-due` |
| `PAYMENT_SUCCESS` / `PAYMENT_CONFIRMATION` | `payment-success` |
| `VISITOR_PASS` | `visitor-pass` |
| `VISITOR_APPROVED` | `visitor-approved` |
| `BOOKING_CONFIRMED` | `booking-confirmed` |
| `ANNOUNCEMENT` | `announcement` |
| `TICKET_CREATED` / `TICKET_ASSIGNED` / `TICKET_UPDATE` | `ticket-*` |
| `SERVICE_ASSIGNED` / `SERVICE_UPDATE` | `service-*` |
| `WORK_ORDER_ASSIGNED` / `WORK_ORDER_UPDATE` | `work-order-*` |
| `PASSWORD_RESET` | `otp-requested` / `password-reset` |
| `WELCOME` | `welcome` |

Future events reuse the same engine: add a row to `EVENT_MAP` in
`NotificationRouterService` plus a `.hbs` template. No new channel code, no new
queue, no new delivery table.

---

## 6. Testing

```bash
cd apps/api && npx jest src/modules/notifications
```

Covers chat-id normalisation (local → E.164 → `@c.us`, already-international,
group ids) and the gateway's many status spellings mapping onto the five
platform states.

Manual checks:

| Check | How |
| --- | --- |
| Connection | Platform admin → WhatsApp → Connect → scan QR → status `connected` |
| Reconnection | Stop the gateway container; watchdog flips to `failed`, auto-restarts on return |
| Delivery | Diagnostic send, then Platform admin → Notifications → deliveries |
| Webhook validation | POST with a wrong `x-webhook-signature` → `403` |
