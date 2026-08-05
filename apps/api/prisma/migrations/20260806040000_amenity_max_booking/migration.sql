-- Sprint D — a ceiling on how long one resident can hold an amenity.
--
-- `slotDurationMinutes` is the granularity offered, not a limit, so nothing
-- stopped a single resident reserving the clubhouse from morning to night.
--
-- Nullable with no default: NULL means "no limit", which is exactly today's
-- behaviour, so no existing amenity changes until an admin sets one.
ALTER TABLE "amenities" ADD COLUMN "maxBookingMinutes" INTEGER;
