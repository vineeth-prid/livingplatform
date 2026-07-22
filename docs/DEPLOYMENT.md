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

Set your real domains in `deploy/nginx/edge.conf` (replace `*.living.example`).

## 3. Build & start

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

The API container runs `prisma migrate deploy` on start (applies all migrations
in order), then boots. First run also needs the seed (roles/permissions/demo):

```bash
docker compose -f docker-compose.production.yml exec api \
  node node_modules/prisma/build/index.js db seed
# (or run `pnpm --filter @living/api db:seed` against DATABASE_URL from a shell)
```

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
