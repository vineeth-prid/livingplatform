-- Sprint 12 — community module toggles, resident home banners, service base
-- price, auto-assignment provenance, and Service Packages.
--
-- Purely additive. Every new column has a default that preserves today's
-- behaviour: maintenance billing and service packages default to ENABLED, so no
-- existing community loses a surface when this deploys.

-- CreateEnum
CREATE TYPE "ServicePackageStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PackagePurchaseStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED');

-- AlterTable: community module toggles + resident home banners
ALTER TABLE "community_settings" ADD COLUMN "maintenanceBillingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "community_settings" ADD COLUMN "servicePackagesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "community_settings" ADD COLUMN "homeBanners" JSONB;

-- AlterTable: list price per service delivery (used to compute package savings)
ALTER TABLE "services" ADD COLUMN "basePrice" DECIMAL(14,2);

-- AlterTable: auto-assignment provenance + package redemption link
ALTER TABLE "tickets" ADD COLUMN "autoAssigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "service_requests" ADD COLUMN "autoAssigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "service_requests" ADD COLUMN "packagePurchaseId" TEXT;

-- CreateTable
CREATE TABLE "service_packages" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "listPrice" DECIMAL(14,2),
    "durationDays" INTEGER NOT NULL DEFAULT 90,
    "propertyTypes" TEXT[],
    "status" "ServicePackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "iconKey" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_package_items" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_package_purchases" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "residentId" TEXT,
    "unitId" TEXT,
    "userId" TEXT,
    "snapshot" JSONB,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PackagePurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "service_package_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_requests_packagePurchaseId_idx" ON "service_requests"("packagePurchaseId");

CREATE INDEX "service_packages_communityId_idx" ON "service_packages"("communityId");
CREATE INDEX "service_packages_communityId_status_idx" ON "service_packages"("communityId", "status");

CREATE INDEX "service_package_items_packageId_idx" ON "service_package_items"("packageId");
CREATE INDEX "service_package_items_serviceId_idx" ON "service_package_items"("serviceId");
CREATE UNIQUE INDEX "service_package_items_packageId_serviceId_key" ON "service_package_items"("packageId", "serviceId");

CREATE INDEX "service_package_purchases_communityId_idx" ON "service_package_purchases"("communityId");
CREATE INDEX "service_package_purchases_communityId_status_idx" ON "service_package_purchases"("communityId", "status");
CREATE INDEX "service_package_purchases_packageId_idx" ON "service_package_purchases"("packageId");
CREATE INDEX "service_package_purchases_residentId_idx" ON "service_package_purchases"("residentId");
CREATE INDEX "service_package_purchases_paymentId_idx" ON "service_package_purchases"("paymentId");

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_package_purchases" ADD CONSTRAINT "service_package_purchases_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_package_purchases" ADD CONSTRAINT "service_package_purchases_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Tenant RLS (defense-in-depth) ────────────────────────────────────────────
-- Same staged pattern as 20260727000000_tenant_rls / 20260803000000_*: policies
-- are defined and RLS enabled, but stay inert until FORCE ROW LEVEL SECURITY.
DO $$
DECLARE
  t text;
  community_tables text[] := ARRAY['service_packages', 'service_package_purchases'];
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
