-- One login may now back one resident record per community (an owner with
-- flats in two societies). Previously "userId" was globally unique, so the
-- second community's record was saved with no login and was invisible to them.
DROP INDEX "residents_userId_key";
CREATE INDEX "residents_userId_idx" ON "residents"("userId");

-- Backfill: link each active, unlinked resident record to the account whose
-- username is its normalised mobile (last 10 digits — normalizePhone), unless
-- that account already has an active resident record in the same community.
WITH candidates AS (
  SELECT DISTINCT ON (r."communityId", u.id) r.id AS resident_id, u.id AS user_id
  FROM "residents" r
  JOIN "users" u
    ON u.username = RIGHT(REGEXP_REPLACE(r.mobile, '\D', '', 'g'), 10)
   AND u."deletedAt" IS NULL
  WHERE r."userId" IS NULL
    AND r."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "residents" x
      WHERE x."userId" = u.id AND x."communityId" = r."communityId" AND x."deletedAt" IS NULL
    )
  ORDER BY r."communityId", u.id, r."createdAt"
)
UPDATE "residents" r
SET "userId" = c.user_id
FROM candidates c
WHERE r.id = c.resident_id;
