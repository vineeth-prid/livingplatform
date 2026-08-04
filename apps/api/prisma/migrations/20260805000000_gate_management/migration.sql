-- Sprint 13 — Gate Management (delivery entry + resident approval) and the
-- Web Push transport that carries the resident notification.
--
-- PURELY ADDITIVE. No existing table is altered destructively, no column is
-- dropped or retyped, and every new `community_settings` column ships with a
-- default that preserves today's behaviour for communities that predate it.
-- Two new members are appended to the "NotificationEvent" enum; appending is
-- safe for existing rows and existing preference queries.

-- CreateEnum
CREATE TYPE "GateEntryType" AS ENUM ('DELIVERY', 'VISITOR', 'SERVICE_PERSONNEL', 'VEHICLE');
CREATE TYPE "GateEntryStatus" AS ENUM ('CREATED', 'NOTIFIED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "GateEntryAction" AS ENUM ('CREATED', 'NOTIFICATION_SENT', 'NOTIFICATION_FAILED', 'VIEWED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED', 'NOTE');

-- AlterEnum: the Notification Engine learns two new routable events.
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'GATE_ENTRY_ARRIVED';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'GATE_ENTRY_DECIDED';

-- AlterTable: per-community gate configuration. Defaults keep the module on
-- with approval required, matching the specified out-of-the-box behaviour;
-- WhatsApp/email stay OFF so no community starts paying for messages it did
-- not ask for.
ALTER TABLE "community_settings" ADD COLUMN "gateManagementEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "community_settings" ADD COLUMN "gateApprovalEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "community_settings" ADD COLUMN "gatePushEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "community_settings" ADD COLUMN "gateWhatsappEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "community_settings" ADD COLUMN "gateEmailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "community_settings" ADD COLUMN "gateSoundEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "gates" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "gateId" TEXT,
    "entryType" "GateEntryType" NOT NULL DEFAULT 'DELIVERY',
    "status" "GateEntryStatus" NOT NULL DEFAULT 'CREATED',
    "entryNumber" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "residentId" TEXT,
    "vendorName" TEXT,
    "deliveryType" TEXT,
    "personName" TEXT NOT NULL,
    "mobileNumber" TEXT,
    "vehicleNumber" TEXT,
    "remarks" TEXT,
    "photoKey" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "notificationFailed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "gate_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_entry_timeline" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "action" "GateEntryAction" NOT NULL,
    "status" "GateEntryStatus",
    "note" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "channel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_entry_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_entry_attachments" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'PHOTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "gate_entry_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gates_communityId_name_key" ON "gates"("communityId", "name");
CREATE INDEX "gates_communityId_idx" ON "gates"("communityId");

CREATE UNIQUE INDEX "gate_entries_communityId_entryNumber_key" ON "gate_entries"("communityId", "entryNumber");
CREATE INDEX "gate_entries_communityId_status_idx" ON "gate_entries"("communityId", "status");
CREATE INDEX "gate_entries_communityId_entryType_createdAt_idx" ON "gate_entries"("communityId", "entryType", "createdAt");
CREATE INDEX "gate_entries_communityId_createdAt_idx" ON "gate_entries"("communityId", "createdAt");
CREATE INDEX "gate_entries_unitId_idx" ON "gate_entries"("unitId");
CREATE INDEX "gate_entries_residentId_status_idx" ON "gate_entries"("residentId", "status");
CREATE INDEX "gate_entries_mobileNumber_idx" ON "gate_entries"("mobileNumber");

CREATE INDEX "gate_entry_timeline_entryId_createdAt_idx" ON "gate_entry_timeline"("entryId", "createdAt");
CREATE INDEX "gate_entry_attachments_entryId_idx" ON "gate_entry_attachments"("entryId");

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gate_entries" ADD CONSTRAINT "gate_entries_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gate_entries" ADD CONSTRAINT "gate_entries_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "gate_entry_timeline" ADD CONSTRAINT "gate_entry_timeline_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "gate_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gate_entry_attachments" ADD CONSTRAINT "gate_entry_attachments_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "gate_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── RLS backstop ────────────────────────────────────────────────────────────
-- Same convention and same inert-until-FORCEd posture as migration
-- 20260727000000_tenant_rls: policies are defined and RLS enabled, but Prisma's
-- role owns the tables so nothing is enforced until prisma/rls/ACTIVATE.sql is
-- run. `gate_entries` carries "tenantId" directly; `gates` links via community.
ALTER TABLE "gate_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "gate_entries"
  USING (
    coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );

ALTER TABLE "gates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "gates"
  USING (
    coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR EXISTS (
      SELECT 1 FROM "communities" c
      WHERE c.id = "gates"."communityId"
        AND c."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR EXISTS (
      SELECT 1 FROM "communities" c
      WHERE c.id = "gates"."communityId"
        AND c."tenantId" = current_setting('app.tenant_id', true)
    )
  );
