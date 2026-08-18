-- Every service carries a price.
--
-- `basePrice` was nullable, meaning "not priced". Two things went wrong with
-- that. A package's list price is the sum of its services, and the builder
-- returned NULL the moment one unpriced service was added — so picking a
-- default service wiped a total the user had already assembled, with nothing on
-- screen explaining why. And a resident browsing the catalog saw "—" where a
-- price belongs, which reads as broken rather than free.
--
-- Existing NULLs become 0. That is a real, meaningful price (free of charge) and
-- it is the only value that cannot misrepresent what a community was already
-- charging — anything else would invent revenue. Rows touched here should be
-- reviewed: the query at the bottom of this file lists them.
UPDATE "services" SET "basePrice" = 0 WHERE "basePrice" IS NULL;

ALTER TABLE "services" ALTER COLUMN "basePrice" SET NOT NULL;
ALTER TABLE "services" ALTER COLUMN "basePrice" SET DEFAULT 0;

-- Review after deploying:
--   SELECT id, key, name FROM services WHERE "basePrice" = 0 ORDER BY name;
-- Anything in that list which is not genuinely free needs pricing in
-- Portal → Services.
