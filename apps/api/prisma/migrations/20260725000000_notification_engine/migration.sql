-- Notification Engine refactor: generalize email delivery tracking into a
-- channel-agnostic notification delivery table. Existing email rows are
-- preserved and default to channel = 'email'. Additive + rename only.

-- Enum: EmailStatus -> NotificationStatus (+ READ for delivery receipts)
ALTER TYPE "EmailStatus" RENAME TO "NotificationStatus";
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'READ' AFTER 'DELIVERED';

-- Table: email_deliveries -> notification_deliveries
ALTER TABLE "email_deliveries" RENAME TO "notification_deliveries";

-- New columns
ALTER TABLE "notification_deliveries" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "notification_deliveries" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "notification_deliveries" ADD COLUMN "readAt" TIMESTAMP(3);

-- Keep the default only as a migration convenience; the app always sets channel.
ALTER TABLE "notification_deliveries" ALTER COLUMN "channel" DROP DEFAULT;

-- Rename constraint + indexes to match the new table name
ALTER INDEX "email_deliveries_pkey" RENAME TO "notification_deliveries_pkey";
ALTER INDEX "email_deliveries_status_idx" RENAME TO "notification_deliveries_status_idx";
ALTER INDEX "email_deliveries_provider_idx" RENAME TO "notification_deliveries_provider_idx";
ALTER INDEX "email_deliveries_tenantId_idx" RENAME TO "notification_deliveries_tenantId_idx";
ALTER INDEX "email_deliveries_createdAt_idx" RENAME TO "notification_deliveries_createdAt_idx";
ALTER INDEX "email_deliveries_queueJobId_idx" RENAME TO "notification_deliveries_queueJobId_idx";

-- New indexes
CREATE INDEX "notification_deliveries_channel_idx" ON "notification_deliveries"("channel");
CREATE INDEX "notification_deliveries_providerMessageId_idx" ON "notification_deliveries"("providerMessageId");
