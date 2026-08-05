-- Sprint A — staff specialities, and the taxonomy split between staff and vendors.
--
-- `staff.categories` holds the ticket-category KEYS a staff member handles.
-- It is what lets a request be auto-assigned to the right person instead of
-- landing in one undifferentiated queue.
--
-- Additive and non-breaking: the column defaults to an empty array, which means
-- "no speciality" — existing staff keep behaving exactly as they do today
-- (manual assignment only) until an admin sets their categories.

ALTER TABLE "staff" ADD COLUMN "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill explicitly so the column is NOT NULL-safe for Prisma's String[]
-- mapping, which treats a null array and an empty array differently.
UPDATE "staff" SET "categories" = ARRAY[]::TEXT[] WHERE "categories" IS NULL;
ALTER TABLE "staff" ALTER COLUMN "categories" SET NOT NULL;

CREATE INDEX "staff_categories_idx" ON "staff" USING GIN ("categories");
