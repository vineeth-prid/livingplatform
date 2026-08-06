-- Give existing vendors the community coverage they were created without.
--
-- The portal's vendor form never sent `communityIds`, so every vendor created
-- through it was stored covering NOTHING. Coverage is what auto-assignment,
-- manual assignment and AMC creation all filter on, so those vendors were inert:
-- listed in the register, and rejected everywhere with "vendor does not cover
-- this community".
--
-- Only vendors with an EMPTY array are touched. A vendor someone deliberately
-- scoped to a subset of communities keeps that scope.
UPDATE "vendors" v
SET "communityIds" = ARRAY(
  SELECT c."id" FROM "communities" c
  WHERE c."tenantId" = v."tenantId" AND c."deletedAt" IS NULL
)
WHERE v."deletedAt" IS NULL
  AND coalesce(array_length(v."communityIds", 1), 0) = 0;
