# Deployment Guide — Living v1.0

Target: **Ubuntu 24.04 VPS**, Docker + Compose, behind **Cloudflare** (Full/Strict
TLS). Stack: Postgres 16, Redis 7, MinIO, the NestJS API, three static frontends
(portal / resident / workforce), and an nginx edge.

## 1. Host prerequisites

```bash
# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-login
docker compose version
```

Open only **80/443** to Cloudflare (lock the origin to Cloudflare IP ranges via
UFW/Cloudflare Tunnel). Postgres/Redis/MinIO stay on the internal Docker network —
never publish their ports.

## 2. Get the code + configure

```bash
git clone <repo> living && cd living
cp deploy/.env.production.example .env.production
# Edit .env.production: strong DB/MinIO passwords, two distinct 48-char JWT
# secrets (openssl rand -base64 48), your CORS_ORIGINS, WEB_APP_URL, SMTP creds,
# and VITE_API_BASE_URL (e.g. https://api.living.example/api/v1).
```

**Also required from v1.1 (Sprint 11):**

```bash
openssl rand -base64 48   # → APP_ENCRYPTION_KEY   (REQUIRED in production)
```

| Variable | Why |
| --- | --- |
| `APP_ENCRYPTION_KEY` | AES-256-GCM key for Razorpay key secrets, webhook secrets and WhatsApp API keys. **Boot fails in production without it.** Rotating it makes every stored secret undecryptable — they must be re-entered. Back it up with the same care as the DB password. |
| `AUTH_DEFAULT_PASSWORD` | The one-time password handed to every provisioned resident/staff/vendor. **Change it from `Living@123`.** |
| `WHATSAPP_PROVIDER` + `OPENWA_*` | Only if using the self-hosted gateway — see [`whatsapp.md`](whatsapp.md). |
| `BILLING_SWEEP_ENABLED` | Leave `true` on exactly one API replica. |

Per-community Razorpay credentials are **not** env vars — they are entered in
the portal and stored encrypted. See [`payments.md`](payments.md).

Set your real domains in `deploy/nginx/edge.conf` (replace `*.living.example`).

## 3. Build & start

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

The API container runs `prisma migrate deploy` on start (applies all migrations
in order), then boots. First run also needs the seed — it is what creates the
roles and permission grants, including SECURITY. No migration inserts roles.

```bash
docker compose -f docker-compose.production.yml exec -e SEED_SKIP_DEMO=true api \
  node node_modules/prisma/build/index.js db seed
# (or run `pnpm --filter @living/api db:seed` against DATABASE_URL from a shell)
```

**`SEED_SKIP_DEMO=true` is the production path.** Without it the seed also
creates the `living-demo` tenant and two accounts whose password is published
in this repository (`admin@living.local` / `association@living.local`). Omit the
flag only on a throwaway environment where you want the demo community.

The seed is idempotent and safe to re-run — but grants are an *authoritative
sync*: it revokes any permission no longer in the role definition. Always seed
from the same commit you deployed, never an older checkout.

## 4. Cloudflare / DNS

Point these records (proxied, orange cloud) at the VPS IP:

| Host | Serves |
| --- | --- |
| `api.living.example` | API (`edge` → `api:4000`) |
| `admin.living.example` | Portal |
| `app.living.example` | Resident PWA |
| `gate.living.example` | Workforce PWA |

Cloudflare SSL mode **Full (Strict)**; enable Always Use HTTPS, HSTS, and Bot
Fight Mode. The edge listens on `:80` behind Cloudflare (add certs + `:443` to
`edge.conf` if terminating TLS at the origin instead).

## 5. Verify

```bash
curl -fsS https://api.living.example/api/v1/health           # liveness → {status:ok}
curl -fsS https://api.living.example/api/v1/health/ready      # readiness (db/redis/mem)
docker compose -f docker-compose.production.yml ps            # all healthy
```

Open the portal, sign in with the seeded admin (`admin@living.local` /
`Living!2024` — **change immediately**), confirm a community loads.

### Post-deploy checklist (Sprint 11)

| Step | Where |
| --- | --- |
| Enter each community's two Razorpay accounts | Portal → Billing → Payment settings, then **Test connection** |
| Register the Razorpay webhooks | Razorpay Dashboard → Webhooks → `…/payments/webhooks/razorpay/<communityId>/<PURPOSE>` |
| Configure maintenance charges per property type | Portal → Billing → Maintenance charges |
| Run the first billing cycle as a dry run | Portal → Billing → Collection → Generate invoices → **Preview** |
| Pair WhatsApp (if `WHATSAPP_PROVIDER=openwa`) | Portal → Platform admin → WhatsApp → Connect → scan QR |
| Set per-community notification routing | Portal → Billing → Notifications |
| Verify the Resident PWA installs | Open on Android Chrome → Install banner appears |

### Post-deploy checklist (Sprint 12)

| Step | Where |
| --- | --- |
| Reseed for the new permissions | `pnpm --filter @living/api db:seed` — `service:catalog:*`, `package:*`, `insights:read` |
| Confirm the module toggles per community | Portal → Community → Settings. **Both default to ON**, so review any community that does not collect through Living. |
| Set list prices on services | Portal → Catalog → Services — required before a package can advertise a saving |
| Check vendor coverage | Auto-assignment needs `communityIds` and a matching `category`/`serviceCategories` on each vendor |
| Add resident home banners (optional) | Portal → Community → Settings → Home banners |

## 6. Updating

```bash
git pull
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
# Migrations apply automatically on api start. Frontends are rebuilt (new hashes);
# PWA service workers auto-update (registerType: autoUpdate).
```

Zero-downtime tip: build first (`... build`), then `up -d` swaps containers; the
edge retries the upstream. For migrations that aren't backward-compatible, use a
maintenance window.

## 7. Object storage (MinIO — production)

MinIO ships in the stack and the API has a production **`S3StorageProvider`**.
Set `STORAGE_DRIVER=s3` (default in `.env.production.example`) and the API:

- connects to MinIO using the compose-injected endpoint/credentials,
- **auto-verifies the bucket, creating it if missing**, and runs a write probe on
  boot (misconfiguration ⇒ the API refuses to start — fail-fast),
- issues presigned upload/download URLs and does real delete/exists.

No code changes are needed to switch — it is **env-only** (`STORAGE_DRIVER=local`
↔ `s3`). For an **external** S3/MinIO, override `MINIO_ENDPOINT`,
`MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `S3_FORCE_PATH_STYLE=false`
(AWS). Set `STORAGE_PUBLIC_URL` to where objects are publicly served (a public
route/CDN in front of MinIO), since download links are stable public URLs.

**Bucket / access key (recommended, least-privilege):** rather than the root key,
create a scoped user + bucket policy:

```bash
# via the MinIO client, tunneled to the console/API
mc alias set living http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing living/living            # (auto-created too)
mc admin user add living living-app "$APP_SECRET"
mc admin policy attach living readwrite --user living-app
# then set MINIO_ACCESS_KEY=living-app / MINIO_SECRET_KEY=$APP_SECRET
```

Set `STORAGE_DRIVER=local` only for the metadata-only dev stub (no bytes stored).
See [`SECURITY.md`](SECURITY.md) and [`BACKUP.md`](BACKUP.md).

See [`OPERATIONS.md`](OPERATIONS.md) for day-2 ops and [`BACKUP.md`](BACKUP.md)
for backup/restore.
