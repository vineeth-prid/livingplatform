#!/usr/bin/env sh
# Encrypted nightly backup of Postgres + uploaded files.
#
# Backups hold every resident's PII and every password hash, so nothing is
# written to disk unencrypted: each stream goes straight through `age` to an
# encrypted file. Only the PUBLIC key lives on the server; the private key that
# can restore stays offline with the operator.
#
#   age-keygen -o living-backup.key        # once, on YOUR machine — keep it safe
#   export BACKUP_AGE_RECIPIENT=age1...    # the public key it prints
#   BACKUP_DIR=/srv/backups ./deploy/backup.sh
#
# Then ship $BACKUP_DIR off-box to versioned / object-locked storage
# (rclone, `mc mirror`, restic …). Restore:
#   age -d -i living-backup.key db-<ts>.sql.gz.age | gunzip | psql ...
set -eu

: "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT to the age public key (age1...)}"
command -v age >/dev/null || { echo "install age (https://age-encryption.org)" >&2; exit 1; }

COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
umask 077
mkdir -p "$BACKUP_DIR"

# 1. Database — logical dump, compressed, encrypted in the pipe.
$COMPOSE exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' \
  | gzip -9 \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$BACKUP_DIR/db-$TS.sql.gz.age"

# 2. Uploaded files — tar the MinIO data volume, encrypted in the pipe.
$COMPOSE exec -T minio sh -c 'tar -C /data -cf - .' \
  | gzip -6 \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$BACKUP_DIR/files-$TS.tar.gz.age"

# 3. Local retention: keep 7 days here; long-term copies live off-box.
find "$BACKUP_DIR" -name '*.age' -mtime +7 -delete

echo "backup ok: $BACKUP_DIR/*-$TS.*.age"
