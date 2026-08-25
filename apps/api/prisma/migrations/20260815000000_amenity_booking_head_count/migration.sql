-- How many people a booking is for.
--
-- Amenity capacity has always been a headcount ("Swimming Pool, 30"), but the
-- booking engine could only count bookings, so a resident had nowhere to say
-- four were coming and a hall for fifty accepted fifty parties. Existing rows
-- default to 1, which is exactly what they meant under the old rule.
ALTER TABLE "amenity_bookings" ADD COLUMN "headCount" INTEGER NOT NULL DEFAULT 1;
