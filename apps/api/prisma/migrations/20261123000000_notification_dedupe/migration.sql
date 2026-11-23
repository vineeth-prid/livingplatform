-- One delivery per event/template/channel/recipient: duplicate event handling
-- is refused by the database, not by a racy read-then-write.
ALTER TABLE "notification_deliveries" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "notification_deliveries_dedupeKey_key" ON "notification_deliveries"("dedupeKey");
