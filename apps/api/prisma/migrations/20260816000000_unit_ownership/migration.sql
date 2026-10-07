-- Unit ownership: who is financially responsible for a flat.
--
-- Separate from `resident_units`, which records who LIVES in it. Maintenance is
-- a debt between the OWNER and the association; a tenant pays their landlord.
-- Treating occupancy as ownership is what showed a tenant the owner's bills.
--
-- Purely additive. No existing row is modified or deleted.

CREATE TYPE "OwnershipStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'INACTIVE');

CREATE TABLE "unit_ownerships" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "sharePercent" DECIMAL(5,2),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "OwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "unit_ownerships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unit_ownerships_unitId_residentId_key" ON "unit_ownerships"("unitId", "residentId");
CREATE INDEX "unit_ownerships_communityId_idx" ON "unit_ownerships"("communityId");
CREATE INDEX "unit_ownerships_unitId_idx" ON "unit_ownerships"("unitId");
CREATE INDEX "unit_ownerships_residentId_idx" ON "unit_ownerships"("residentId");
CREATE INDEX "unit_ownerships_status_idx" ON "unit_ownerships"("status");

ALTER TABLE "unit_ownerships" ADD CONSTRAINT "unit_ownerships_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_ownerships" ADD CONSTRAINT "unit_ownerships_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_ownerships" ADD CONSTRAINT "unit_ownerships_residentId_fkey"
  FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill ONLY what the data states outright: an occupancy row already
-- explicitly marked OWNER. Everything else is left with no ownership record,
-- because guessing here silently moves financial responsibility onto whoever
-- happened to be entered first. Units with no owner are reported to the admin
-- through /communities/:id/units/ownership-gaps, not resolved by inference.
INSERT INTO "unit_ownerships" ("id", "communityId", "unitId", "residentId", "isPrimary", "startDate", "status", "createdAt", "updatedAt", "notes")
SELECT
    md5(random()::text || clock_timestamp()::text)::uuid::text,
    r."communityId",
    ru."unitId",
    ru."residentId",
    true,
    ru."moveInDate",
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'Backfilled from the OWNER occupancy role'
FROM "resident_units" ru
JOIN "residents" r ON r."id" = ru."residentId"
WHERE ru."role" = 'OWNER'
  AND ru."status" = 'ACTIVE'
  AND r."deletedAt" IS NULL
ON CONFLICT ("unitId", "residentId") DO NOTHING;
