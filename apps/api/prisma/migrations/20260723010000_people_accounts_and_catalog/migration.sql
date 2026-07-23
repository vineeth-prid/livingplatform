-- People accounts & managed catalogs
-- 1. Phone-number logins: users.username (unique) + forced password change.
-- 2. Unit owner contact fields; "Occupied By" roles on resident↔unit.
-- 3. staff.role / vendor.category become free strings (admin-managed lists).
-- 4. catalog_options: tenant-managed option lists (staff roles, vendor categories).

-- AlterEnum: resident↔unit occupancy roles
ALTER TYPE "ResidentRole" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "ResidentRole" ADD VALUE IF NOT EXISTS 'TENANT';

-- AlterTable: users — phone-number login + first-login password change
ALTER TABLE "users"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AlterTable: units — owner contact
ALTER TABLE "units"
  ADD COLUMN "ownerName" TEXT,
  ADD COLUMN "ownerPhone" TEXT;

-- AlterTable: staff.role enum → text (values preserved verbatim)
ALTER TABLE "staff" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
DROP TYPE IF EXISTS "StaffRole";

-- AlterTable: vendors.category / serviceCategories enum → text
ALTER TABLE "vendors" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;
ALTER TABLE "vendors" ALTER COLUMN "serviceCategories" TYPE TEXT[] USING "serviceCategories"::TEXT[];
DROP TYPE IF EXISTS "VendorCategory";

-- CreateTable: catalog_options
CREATE TABLE "catalog_options" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "catalog_options_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "catalog_options_tenantId_kind_name_key" ON "catalog_options"("tenantId", "kind", "name");
CREATE INDEX "catalog_options_tenantId_kind_idx" ON "catalog_options"("tenantId", "kind");
