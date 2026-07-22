# Backup & Restore — Living v1.0

Three things hold state: **Postgres** (all business data + audit trail), **MinIO**
(uploaded files, once `STORAGE_DRIVER=s3`), and **Redis** (refresh-token sessions —
loss only forces re-login, not data loss). Postgres is the critical asset.

`COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"`

## Database — backup

```bash
# Nightly logical dump (compressed, timestamped)
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" \
  > "/var/backups/living/living-$(date +%F-%H%M).dump"
```

Automate with cron (`/etc/cron.d/living-backup`):

```cron
30 2 * * * root cd /opt/living && docker compose -f docker-compose.production.yml --env-file .env.production exec -T postgres pg_dump -U living -Fc living | gzip > /var/backups/living/db-$(date +\%F).dump.gz
```

## Database — restore

```bash
# Into a clean database (stop the API first to avoid writes)
$COMPOSE stop api
gunzip -c /var/backups/living/db-YYYY-MM-DD.dump.gz | \
  $COMPOSE exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
$COMPOSE start api
```

Test restores **monthly** into a throwaway DB — an untested backup is not a backup.

## Uploads (MinIO / S3)

The API's `S3StorageProvider` **auto-creates the bucket** on boot; you only back
up its **contents**. Object keys are stored in Postgres (`storageKey` columns), so
a consistent recovery restores **both** the DB and the bucket to the same point.

**Backup — mirror the bucket off-box** (nightly):

```bash
mc alias set src http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mirror --overwrite --remove src/$STORAGE_BUCKET /backup/living-objects   # or an rclone/S3 remote
```

**Restore — mirror back into a fresh bucket:**

```bash
mc mirror --overwrite /backup/living-objects src/$STORAGE_BUCKET
```

Or snapshot the `minio-data` volume (same `docker run … tar` pattern as Postgres).

**Migration from `local` → `s3`:** the `local` driver stores **no bytes** (metadata
only), so historical stub records have no objects to move — set `STORAGE_DRIVER=s3`
and **new** uploads land in MinIO. Existing rows keep their `storageKey`; their
download links resolve once the object exists. No DB migration is needed (keys are
provider-agnostic and identical in format across drivers).

**Disaster recovery (full):** on a fresh host — (1) `up -d` the stack (bucket
auto-creates), (2) restore the Postgres dump, (3) `mc mirror` the objects back,
(4) verify `/health/ready` shows `database`, `redis`, `storage` all up. Keep the
DB dump and the object backup from the **same window** to avoid dangling keys.

## Volumes (alternative / disaster)

```bash
# Cold snapshot of a named volume
docker run --rm -v living_postgres-data:/data -v /var/backups/living:/out \
  alpine tar czf /out/postgres-vol-$(date +%F).tgz -C /data .
```

## Retention

| Tier | Keep | Where |
| --- | --- | --- |
| Daily logical dumps | 14 days | on-box `/var/backups` |
| Weekly | 8 weeks | off-box (S3/object) |
| Monthly | 12 months | off-box, immutable/versioned |

Encrypt off-box backups (they contain PII + password hashes). Store the
`.env.production` secrets in a **separate** secret manager — a DB backup without
the JWT secrets is useless to an attacker, and vice-versa.

## RPO / RTO targets

- **RPO** ≤ 24h (nightly dump) — tighten with WAL archiving / streaming replica
  if sub-hour RPO is required.
- **RTO** ≤ 1h (restore + start on a fresh host from image + dump).
