-- Sprint 11 — Payments (community Razorpay), Maintenance Billing, Auth
-- hardening (password history) and WhatsApp gateway sessions.
--
-- Purely additive: no existing table or column is altered or dropped.

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('MAINTENANCE', 'SERVICE');
CREATE TYPE "PaymentGatewayMode" AS ENUM ('TEST', 'LIVE');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'QR_PENDING', 'CONNECTED', 'FAILED');
CREATE TYPE "NotificationEvent" AS ENUM (
  'MAINTENANCE_DUE', 'PAYMENT_SUCCESS', 'PAYMENT_CONFIRMATION', 'VISITOR_PASS',
  'VISITOR_APPROVED', 'BOOKING_CONFIRMED', 'ANNOUNCEMENT', 'TICKET_CREATED',
  'TICKET_ASSIGNED', 'TICKET_UPDATE', 'SERVICE_ASSIGNED', 'SERVICE_UPDATE',
  'WORK_ORDER_ASSIGNED', 'WORK_ORDER_UPDATE', 'PASSWORD_RESET', 'WELCOME'
);

-- CreateTable
CREATE TABLE "community_payment_configs" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "mode" "PaymentGatewayMode" NOT NULL DEFAULT 'TEST',
    "accountName" TEXT,
    "merchantId" TEXT,
    "keyId" TEXT,
    "keySecretEnc" TEXT,
    "webhookSecretEnc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "community_payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_charges" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(14,2) NOT NULL,
    "quarterlyAmount" DECIMAL(14,2),
    "yearlyAmount" DECIMAL(14,2),
    "lateFeeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lateFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "maintenance_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_invoices" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "residentId" TEXT,
    "chargeId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "cycle" "BillingCycle" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "baseAmount" DECIMAL(14,2) NOT NULL,
    "lateFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "maintenance_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "configId" TEXT,
    "invoiceId" TEXT,
    "serviceRequestId" TEXT,
    "unitId" TEXT,
    "residentId" TEXT,
    "userId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "gateway" TEXT NOT NULL DEFAULT 'razorpay',
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "gatewaySignature" TEXT,
    "method" TEXT,
    "receiptNumber" TEXT,
    "failureReason" TEXT,
    "gatewayResponse" JSONB,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openwa',
    "externalId" TEXT,
    "status" "WhatsAppSessionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "phoneNumber" TEXT,
    "apiKeyEnc" TEXT,
    "lastQr" TEXT,
    "lastQrAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_notification_preferences" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "community_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_notification_templates" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "channel" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "community_notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "community_payment_configs_communityId_idx" ON "community_payment_configs"("communityId");
CREATE UNIQUE INDEX "community_payment_configs_communityId_purpose_key" ON "community_payment_configs"("communityId", "purpose");

CREATE INDEX "maintenance_charges_communityId_idx" ON "maintenance_charges"("communityId");
CREATE INDEX "maintenance_charges_communityId_propertyType_idx" ON "maintenance_charges"("communityId", "propertyType");
CREATE UNIQUE INDEX "maintenance_charges_communityId_propertyType_effectiveFrom_key" ON "maintenance_charges"("communityId", "propertyType", "effectiveFrom");

CREATE INDEX "maintenance_invoices_communityId_idx" ON "maintenance_invoices"("communityId");
CREATE INDEX "maintenance_invoices_communityId_status_idx" ON "maintenance_invoices"("communityId", "status");
CREATE INDEX "maintenance_invoices_unitId_idx" ON "maintenance_invoices"("unitId");
CREATE INDEX "maintenance_invoices_residentId_idx" ON "maintenance_invoices"("residentId");
CREATE INDEX "maintenance_invoices_dueDate_idx" ON "maintenance_invoices"("dueDate");
CREATE UNIQUE INDEX "maintenance_invoices_communityId_invoiceNumber_key" ON "maintenance_invoices"("communityId", "invoiceNumber");
CREATE UNIQUE INDEX "maintenance_invoices_unitId_cycle_periodStart_key" ON "maintenance_invoices"("unitId", "cycle", "periodStart");

CREATE INDEX "payments_communityId_idx" ON "payments"("communityId");
CREATE INDEX "payments_communityId_purpose_idx" ON "payments"("communityId", "purpose");
CREATE INDEX "payments_communityId_status_idx" ON "payments"("communityId", "status");
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");
CREATE INDEX "payments_residentId_idx" ON "payments"("residentId");
CREATE INDEX "payments_gatewayOrderId_idx" ON "payments"("gatewayOrderId");
CREATE INDEX "payments_gatewayPaymentId_idx" ON "payments"("gatewayPaymentId");

CREATE INDEX "password_history_userId_createdAt_idx" ON "password_history"("userId", "createdAt");

CREATE UNIQUE INDEX "whatsapp_sessions_name_key" ON "whatsapp_sessions"("name");
CREATE INDEX "whatsapp_sessions_status_idx" ON "whatsapp_sessions"("status");

CREATE INDEX "community_notification_preferences_communityId_idx" ON "community_notification_preferences"("communityId");
CREATE UNIQUE INDEX "community_notification_preferences_communityId_event_key" ON "community_notification_preferences"("communityId", "event");

CREATE INDEX "community_notification_templates_communityId_idx" ON "community_notification_templates"("communityId");
CREATE UNIQUE INDEX "community_notification_templates_communityId_event_channel_locale_key" ON "community_notification_templates"("communityId", "event", "channel", "locale");

-- AddForeignKey
ALTER TABLE "community_payment_configs" ADD CONSTRAINT "community_payment_configs_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "maintenance_charges" ADD CONSTRAINT "maintenance_charges_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "maintenance_invoices" ADD CONSTRAINT "maintenance_invoices_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_invoices" ADD CONSTRAINT "maintenance_invoices_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_invoices" ADD CONSTRAINT "maintenance_invoices_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "maintenance_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_configId_fkey" FOREIGN KEY ("configId") REFERENCES "community_payment_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "maintenance_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "password_history" ADD CONSTRAINT "password_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_notification_preferences" ADD CONSTRAINT "community_notification_preferences_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_notification_templates" ADD CONSTRAINT "community_notification_templates_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Tenant RLS (defense-in-depth) ────────────────────────────────────────────
-- Same staged pattern as 20260727000000_tenant_rls: policies are defined and RLS
-- enabled, but stay inert until FORCE ROW LEVEL SECURITY (prisma/rls/ACTIVATE.sql).
-- All new tenant-owned tables reach the tenant through their community.
DO $$
DECLARE
  t text;
  community_tables text[] := ARRAY[
    'community_payment_configs', 'maintenance_charges', 'maintenance_invoices',
    'payments', 'community_notification_preferences', 'community_notification_templates'
  ];
BEGIN
  FOREACH t IN ARRAY community_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
      USING (
        coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
        OR "communityId" IN (
          SELECT id FROM communities WHERE "tenantId" = current_setting('app.tenant_id', true)
        )
      )
      WITH CHECK (
        coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
        OR "communityId" IN (
          SELECT id FROM communities WHERE "tenantId" = current_setting('app.tenant_id', true)
        )
      )
    $f$, t);
  END LOOP;
END $$;
