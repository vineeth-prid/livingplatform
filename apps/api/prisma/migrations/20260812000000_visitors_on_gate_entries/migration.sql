-- Visitors become gate entries.
--
-- There were two parallel systems. "Invite a visitor" wrote `visitors`, while
-- the security console reads `gate_entries` — so an invited visitor never
-- reached the gate, and approving one in the admin portal changed nothing the
-- guard could see. GateEntryType already had VISITOR; the table was simply never
-- used for them.
--
-- Two columns are all `gate_entries` was missing:
--   expectedArrival — a visit is announced in advance; a delivery just turns up
--   passCode        — what the visitor presents at the gate
ALTER TABLE "gate_entries" ADD COLUMN "expectedArrival" TIMESTAMP(3);
ALTER TABLE "gate_entries" ADD COLUMN "passCode" TEXT;

-- Postgres treats NULLs as distinct in a unique index, so pass-less deliveries
-- never collide. Plain (not partial) so it matches what Prisma's @@unique emits
-- and the next `migrate dev` sees no drift.
CREATE UNIQUE INDEX "gate_entries_communityId_passCode_key"
  ON "gate_entries"("communityId", "passCode");

CREATE INDEX "gate_entries_communityId_expectedArrival_idx"
  ON "gate_entries"("communityId", "expectedArrival");

-- ── Carry the existing visitors across ──────────────────────────────────────
--
-- Every visitor row becomes a VISITOR gate entry so the history a community has
-- already accumulated stays visible in the place that now owns it. `visitors` is
-- left in place, untouched and read-only, rather than dropped: this is
-- reversible for as long as that table exists, and nothing is lost if the
-- mapping below turns out to be wrong about an edge case.
--
-- unitId is NOT NULL on gate_entries but absent from visitors, so it is taken
-- from the visitor's host resident. A visitor whose host has no unit assignment
-- cannot be represented and is skipped — deliberately, because inventing a unit
-- would put a stranger's arrival against somebody's flat.
INSERT INTO "gate_entries" (
  "id", "tenantId", "communityId", "gateId", "entryType", "status", "entryNumber",
  "unitId", "residentId", "personName", "mobileNumber", "vehicleNumber", "remarks",
  "expectedArrival", "passCode", "decidedById", "decidedAt", "completedAt",
  "notificationFailed", "metadata", "createdAt", "updatedAt", "deletedAt",
  "createdById", "updatedById"
)
SELECT
  v."id",
  v."tenantId",
  v."communityId",
  (SELECT g."id" FROM "gates" g
    WHERE g."communityId" = v."communityId" AND g."deletedAt" IS NULL
    ORDER BY g."createdAt" ASC LIMIT 1),
  'VISITOR',
  CASE v."status"
    WHEN 'PENDING'     THEN 'CREATED'
    WHEN 'APPROVED'    THEN 'APPROVED'
    WHEN 'REJECTED'    THEN 'REJECTED'
    WHEN 'CANCELLED'   THEN 'CANCELLED'
    -- A visitor who came and went is a completed arrival; the gate lifecycle
    -- has no separate checked-in state, and the timestamps carry the detail.
    WHEN 'CHECKED_IN'  THEN 'APPROVED'
    WHEN 'CHECKED_OUT' THEN 'COMPLETED'
    ELSE 'CREATED'
  END::"GateEntryStatus",
  -- Distinct from the GE-000123 sequence so a migrated row is identifiable.
  'V-' || upper(substr(md5(v."id"), 1, 8)),
  ru."unitId",
  v."residentId",
  v."visitorName",
  v."mobileNumber",
  v."vehicleNumber",
  COALESCE(v."purpose", v."notes"),
  v."expectedArrival",
  v."passCode",
  v."approvedById",
  CASE WHEN v."status" IN ('APPROVED', 'REJECTED') THEN v."updatedAt" END,
  v."actualCheckOut",
  false,
  jsonb_build_object(
    'migratedFrom', 'visitors',
    'visitorType', v."visitorType",
    'originalStatus', v."status",
    'actualCheckIn', v."actualCheckIn"
  ),
  v."createdAt",
  v."updatedAt",
  v."deletedAt",
  v."createdById",
  v."updatedById"
FROM "visitors" v
JOIN "resident_units" ru ON ru."residentId" = v."residentId"
WHERE NOT EXISTS (SELECT 1 FROM "gate_entries" ge WHERE ge."id" = v."id")
ON CONFLICT DO NOTHING;
