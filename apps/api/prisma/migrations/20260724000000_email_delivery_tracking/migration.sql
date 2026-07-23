-- Notification Engine · Email delivery tracking
-- One row per email the Email Service handles; Platform Admin reads statistics.

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "communityId" TEXT,
    "provider" TEXT NOT NULL,
    "recipients" TEXT[],
    "cc" TEXT[],
    "bcc" TEXT[],
    "subject" TEXT NOT NULL,
    "template" TEXT,
    "locale" TEXT,
    "priority" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "providerMessageId" TEXT,
    "providerResponse" JSONB,
    "error" TEXT,
    "durationMs" INTEGER,
    "queueJobId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries"("status");
CREATE INDEX "email_deliveries_provider_idx" ON "email_deliveries"("provider");
CREATE INDEX "email_deliveries_tenantId_idx" ON "email_deliveries"("tenantId");
CREATE INDEX "email_deliveries_createdAt_idx" ON "email_deliveries"("createdAt");
CREATE INDEX "email_deliveries_queueJobId_idx" ON "email_deliveries"("queueJobId");
