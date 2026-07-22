# Environment Variable Reference

Every variable the API reads is **validated at boot** by
`apps/api/src/config/env.validation.ts` — a missing or malformed **required**
variable fails fast with a clear message; the app never starts half-configured.
Frontend variables are **baked at build time** (Vite).

## API (`apps/api`)

| Variable | Req | Default | Notes |
| --- | :-: | --- | --- |
| `NODE_ENV` | — | `development` | `production` in prod. |
| `PORT` | — | `4000` | Listen port. |
| `API_PREFIX` | — | `api` | Global route prefix → `/api/v1/...`. |
| `CORS_ORIGINS` | — | `http://localhost:5173` | **Comma-separated exact origins.** Empty ⇒ reflects any origin (dev only) — always set explicit origins in prod. |
| `DATABASE_URL` | **✓** | — | Postgres connection string. |
| `REDIS_URL` | — | `redis://localhost:6379` | Refresh-token store / cache. |
| `JWT_ACCESS_SECRET` | **✓** | — | **≥ 32 chars.** Access-token signing key. |
| `JWT_REFRESH_SECRET` | **✓** | — | **≥ 32 chars, distinct from access.** |
| `JWT_ACCESS_TTL` | — | `15m` | Access-token lifetime. |
| `JWT_REFRESH_TTL` | — | `7d` | Refresh lifetime. |
| `JWT_REFRESH_TTL_REMEMBER` | — | `30d` | "Remember me" refresh lifetime. |
| `SMTP_HOST` | — | `localhost` | Transactional email (verify / reset). |
| `SMTP_PORT` | — | `1025` | 587 for TLS providers. |
| `SMTP_USER` / `SMTP_PASSWORD` | — | `` | Provider credentials. |
| `MAIL_FROM` | — | `Living <no-reply@living.local>` | From header. |
| `WEB_APP_URL` | — | `http://localhost:5173` | Base for verify/reset links. |
| `THROTTLE_TTL` | — | `60` | Rate-limit window (seconds). |
| `THROTTLE_LIMIT` | — | `120` | Requests per window per IP. |
| `STORAGE_DRIVER` | — | `local` | `local` metadata stub, or **`s3`** (production MinIO/S3). Switching is env-only — no code change. |
| `STORAGE_BUCKET` | — | `living-local` | Bucket name (also the `s3` default bucket). |
| `STORAGE_PUBLIC_URL` | — | `http://localhost:4000/storage` | Base URL where stored objects are publicly reachable (`<endpoint>/<bucket>` for path-style MinIO, or a CDN). |
| `STORAGE_SIGNED_URL_TTL` | — | `900` | Legacy signed-URL TTL (fallback for `SIGNED_URL_EXPIRY`). |

### MinIO / S3 (required only when `STORAGE_DRIVER=s3` — validated at boot, fail-fast)

| Variable | Req (s3) | Default | Notes |
| --- | :-: | --- | --- |
| `MINIO_ENDPOINT` | **✓** | — | Host **without** scheme, e.g. `minio` (compose) or `s3.example.com`. |
| `MINIO_PORT` | — | `9000` | API port. |
| `MINIO_SSL` | — | `false` | `true` for HTTPS endpoints. |
| `MINIO_ACCESS_KEY` | **✓** | — | Access key (scoped, not root, in prod). |
| `MINIO_SECRET_KEY` | **✓** | — | Secret key — never logged/exposed. |
| `MINIO_BUCKET` | — | `STORAGE_BUCKET` | Bucket (auto-created on boot if missing). |
| `MINIO_REGION` | — | `us-east-1` | S3 region. |
| `S3_FORCE_PATH_STYLE` | — | `true` | `true` for MinIO; `false` for AWS S3 virtual-hosted. |
| `SIGNED_URL_EXPIRY` | — | `900` | Signed upload/download URL lifetime (seconds). |

> On boot with `s3`, the provider verifies the bucket (creating it if missing),
> runs a write probe, and **fails fast** if unreachable or the credentials can't
> write. The readiness probe (`/health/ready`) then pings the bucket continuously.
| `PM_SCHEDULER_ENABLED` | — | `true` | Preventive-maintenance cron; `false` disables on an instance. |
| `AMC_EXPIRY_ENABLED` | — | `true` | Daily AMC expiry/renewal sweep. |
| `ANNOUNCEMENT_SWEEP_ENABLED` | — | `true` | Hourly announcement publish/expire sweep. |

> **Scheduler note (multi-instance):** if you run **more than one** API replica,
> set `PM_SCHEDULER_ENABLED` / `AMC_EXPIRY_ENABLED` / `ANNOUNCEMENT_SWEEP_ENABLED`
> to `false` on all but one replica (or run a dedicated single-replica worker) —
> the generation logic is idempotent (compare-and-swap), so duplicates are
> prevented, but running the sweeps on one node avoids redundant work.

## Frontends (build-time, Vite)

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | **Baked into the bundle at build.** Pass as a Docker build-arg (`deploy/Dockerfile.web`). Rebuild images to change it. |

## Compose / infrastructure (`docker-compose.production.yml`)

`POSTGRES_USER/PASSWORD/DB`, `MINIO_ROOT_USER/PASSWORD`, `CORS_ORIGINS`,
`WEB_APP_URL`, the JWT/SMTP/storage vars above, and `VITE_API_BASE_URL`. See
[`deploy/.env.production.example`](../deploy/.env.production.example).

## Secret generation

```bash
openssl rand -base64 48   # one per JWT secret, DB password, MinIO password
```

Never commit real `.env*` files (`.gitignore` + `.dockerignore` exclude them).
