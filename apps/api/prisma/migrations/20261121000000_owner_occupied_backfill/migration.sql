-- Owner-occupied units created before the unit form recorded the owner as the
-- occupant: the owner is on record but nobody "lives" there, so the owner's
-- app showed no home. Record the primary owner as the occupant — only where the
-- unit is marked OWNER_OCCUPIED, has no active occupant, and the owner lives in
-- no other unit (a resident has at most one home). Data only; idempotent.
INSERT INTO "resident_units" ("id", "residentId", "unitId", "role", "status", "moveInDate", "createdAt", "updatedAt")
SELECT
  'ru' || substr(md5(random()::text || clock_timestamp()::text || o."residentId"), 1, 23),
  o."residentId",
  u."id",
  'OWNER',
  'ACTIVE',
  NOW(),
  NOW(),
  NOW()
FROM "units" u
JOIN "unit_ownerships" o
  ON o."unitId" = u."id" AND o."status" = 'ACTIVE' AND o."deletedAt" IS NULL AND o."isPrimary" = true
JOIN "residents" r
  ON r."id" = o."residentId" AND r."deletedAt" IS NULL
WHERE u."deletedAt" IS NULL
  AND u."ownership" = 'OWNER_OCCUPIED'
  AND NOT EXISTS (SELECT 1 FROM "resident_units" ru WHERE ru."unitId" = u."id" AND ru."status" = 'ACTIVE')
  AND NOT EXISTS (SELECT 1 FROM "resident_units" ru WHERE ru."residentId" = o."residentId");
