# Operations Runbook — Living v1.0

`COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"`

## Health & status

| Check | Command |
| --- | --- |
| Liveness | `curl -fsS https://api.living.example/api/v1/health` |
| Readiness (DB/Redis/**storage**/heap) | `curl -fsS https://api.living.example/api/v1/health/ready` |
| Metrics | `GET /api/v1/metrics` (permission-guarded) |
| Container health | `$COMPOSE ps` (all `healthy`) |
| Logs (structured JSON, pino) | `$COMPOSE logs -f api` |

Kubernetes/orchestrator probes: **liveness** `/api/v1/health`, **readiness**
`/api/v1/health/ready`. Compose healthchecks are already defined per service.

## Logging

Structured JSON via `nestjs-pino`; auth headers/cookies are **redacted**. Health
requests are excluded from access logs. Each request carries a request id.
Retention is capped by the json-file driver (`max-size 10m`, `max-file 5`) — ship
to a log aggregator (Loki/ELK/Cloudflare Logpush) for long-term retention.

Notable log events: startup (`Living API [env] listening…`), scheduler runs
(PM generation, AMC expiry, announcement sweep — counts logged when non-zero),
audit trail (every mutation → `audit_logs` table), and domain-event emissions
(debug level).

## Scheduled jobs (in-process cron)

| Job | Cadence | Toggle |
| --- | --- | --- |
| Preventive-maintenance WO generation | every minute | `PM_SCHEDULER_ENABLED` |
| AMC expiry / renewal sweep | daily 01:00 | `AMC_EXPIRY_ENABLED` |
| Announcement publish / expire | hourly | `ANNOUNCEMENT_SWEEP_ENABLED` |
| Billing overdue + late fees, maintenance-due reminders | daily 02:00 | `BILLING_SWEEP_ENABLED` |
| WhatsApp connection watchdog | every minute (throttled to `OPENWA_HEALTH_INTERVAL_SEC`) | `OPENWA_HEALTH_INTERVAL_SEC=0` |

All are **idempotent** (compare-and-swap). With multiple API replicas, run the
sweeps on exactly one (disable on the others) — see [`ENVIRONMENT.md`](ENVIRONMENT.md).

## Payments

| Situation | What to do |
| --- | --- |
| A resident paid but the invoice still shows a balance | Check Razorpay → Webhooks for delivery failures. Settlement is idempotent, so **redelivering the webhook is safe** and will credit the invoice. |
| "This community has not configured a … payment account yet" | Portal → Billing → Payment settings: the rail is disabled or missing a key id/secret. |
| Webhook returning 403 | Signature mismatch — the webhook secret in Razorpay and in the portal differ, or a proxy is re-serializing the body (the signature is over the **raw bytes**). |
| Credentials rotated at Razorpay | Re-enter Key ID + Key Secret in the portal, then **Test connection**. In-flight orders created with the old key still verify against the new secret only if Razorpay kept it live — prefer rotating during a quiet window. |
| Refund | Portal → Billing → Collection → Transactions (needs `payment:refund`). |
| `APP_ENCRYPTION_KEY` lost | Stored secrets cannot be recovered. Re-enter every community's Razorpay credentials and WhatsApp session keys. Payments and invoices themselves are unaffected. |

Monthly billing is **not** automatic — an admin runs the billing cycle from
Portal → Billing → Collection → *Generate invoices*. Re-running a period is safe
(unique on unit + cycle + period). Preview first; it reports which property types
have no rate in force.

## Community modules

| Situation | What to do |
| --- | --- |
| "Maintenance billing is not enabled for this community" (404) | Expected — that community has the module off. Portal → Community → Settings to check. See [`community-settings.md`](community-settings.md). |
| Billing nav missing for an admin | Same cause. The nav follows `GET /communities/:id/settings/features`; the hook caches for 5 minutes, so a just-flipped toggle can take that long to appear. |
| A community turned billing off mid-month | New checkouts are refused; payments already in flight still settle, and existing invoices/history are kept. The nightly sweep skips them, so no late fees or reminders. |
| Residents cannot see a service | Check Portal → Catalog → Services — it is probably Inactive. Reactivating restores it immediately; nothing was deleted. |
| A package vanished from the resident app | Either the package is INACTIVE, the `servicePackages` module is off, or **every** service in it has been deactivated. |

## Vendor auto-assignment

| Situation | What to do |
| --- | --- |
| Tickets arriving unassigned | No ACTIVE vendor covers that community with a matching category. Check the vendor's `communityIds` and `category`/`serviceCategories` against the ticket category key. |
| Work going to the wrong vendor | Selection is least-open-workload, ties broken by name. Reassign manually — that overwrites `autoAssigned`. |
| Auto-assignment appears to have stopped | It is best-effort and never blocks creation; look for `Auto-assignment failed for …` warnings in the API log. Tickets are still created correctly. |

## WhatsApp (OpenWA)

| Situation | What to do |
| --- | --- |
| Channel unhealthy | Portal → Platform admin → WhatsApp. Status `qr pending` ⇒ scan again; `failed` ⇒ check `lastError` and the gateway container. |
| Session dropped overnight | The watchdog auto-restarts it when `OPENWA_AUTO_RECONNECT=true`. A drop after a phone logout needs a **new QR scan**. |
| Messages queued but not sending | `GET /api/v1/notifications/queue` — check `waiting` / `retrying` / `deadLettered`. The queue is shared with email, so a WhatsApp outage does not stall email. |
| Gateway webhook rejected | `OPENWA_WEBHOOK_SECRET` unset or mismatched. **With no secret the endpoint rejects everything by design.** |
| Reverting to the Meta Cloud API | Set `WHATSAPP_PROVIDER=meta` and restart. No data migration — deliveries and preferences are channel-level, not provider-level. |

## Common tasks

```bash
$COMPOSE restart api                 # restart a service
$COMPOSE exec api node node_modules/prisma/build/index.js migrate status
$COMPOSE exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB   # DB shell
$COMPOSE exec redis redis-cli info memory
$COMPOSE logs --since 15m api | grep -i error
```

## Incident playbook

- **API unhealthy / readiness failing** → check `logs api`; verify Postgres &
  Redis healthy (`$COMPOSE ps`); readiness fails if DB/Redis unreachable or heap
  > 512 MB. Restart API; if OOM, raise the api memory limit.
- **DB connection errors** → `$COMPOSE ps postgres`; check disk (`df -h`); the
  `postgres-data` volume mustn't fill the host.
- **Migrations blocking start** → `migrate status`; a failed migration halts the
  API (fail-fast). Fix forward or restore from backup ([`BACKUP.md`](BACKUP.md)).
- **Rate-limit false positives** → tune `THROTTLE_LIMIT`/`THROTTLE_TTL`; the edge
  also has a coarse `limit_req` backstop in `edge.conf`.
- **Storage (`s3`) readiness failing** → `readiness` shows the `storage` key +
  driver. Check MinIO healthy (`$COMPOSE ps minio`), credentials, and that the
  bucket exists (`mc ls living/$STORAGE_BUCKET`). The API refuses to boot if the
  store is unreachable at startup (fail-fast) — check `logs api` for
  `S3 storage unreachable or credentials invalid`. Uploads/downloads use presigned
  URLs; if links 403, verify `STORAGE_PUBLIC_URL`/bucket-read policy and clock skew.
- **Duplicate PM work orders** → shouldn't happen (CAS); if seen, ensure only one
  replica has the schedulers enabled.

## Scaling

- **API**: stateless (JWT + Redis refresh store) → scale horizontally; keep the
  schedulers on one replica. Add replicas behind the edge upstream.
- **Postgres**: vertical first; add read replicas + PgBouncer when write load
  grows. Indexes are already in place (see the Database Audit).
- **Redis**: single node is fine for the refresh store; enable persistence (AOF,
  already on) and back it up if refresh-session continuity matters.
