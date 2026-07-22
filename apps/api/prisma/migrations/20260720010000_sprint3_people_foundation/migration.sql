-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "ResidentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MOVED_OUT');

-- CreateEnum
CREATE TYPE "ResidentRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('ELECTRICAL', 'PLUMBING', 'CIVIL', 'HOUSEKEEPING', 'SECURITY', 'GARDENING', 'PEST_CONTROL', 'LIFT', 'DG', 'STP', 'HVAC', 'PAINTING', 'GENERAL');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('FACILITY_MANAGER', 'SUPERVISOR', 'SECURITY', 'HOUSEKEEPING', 'ELECTRICIAN', 'PLUMBER', 'TECHNICIAN', 'ADMIN');

-- CreateTable
CREATE TABLE "residents" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT,
    "residentCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "photoKey" TEXT,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "occupation" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelationship" TEXT,
    "moveInDate" TIMESTAMP(3),
    "status" "ResidentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident_units" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "role" "ResidentRole" NOT NULL DEFAULT 'PRIMARY',
    "moveInDate" TIMESTAMP(3),
    "moveOutDate" TIMESTAMP(3),
    "status" "ResidentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "resident_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "category" "VendorCategory" NOT NULL,
    "serviceCategories" "VendorCategory"[],
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "communityIds" TEXT[],
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "department" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "photoKey" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "residents_userId_key" ON "residents"("userId");

-- CreateIndex
CREATE INDEX "residents_communityId_idx" ON "residents"("communityId");

-- CreateIndex
CREATE INDEX "residents_status_idx" ON "residents"("status");

-- CreateIndex
CREATE INDEX "residents_mobile_idx" ON "residents"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "residents_communityId_residentCode_key" ON "residents"("communityId", "residentCode");

-- CreateIndex
CREATE UNIQUE INDEX "resident_units_residentId_key" ON "resident_units"("residentId");

-- CreateIndex
CREATE INDEX "resident_units_unitId_idx" ON "resident_units"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_userId_key" ON "vendors"("userId");

-- CreateIndex
CREATE INDEX "vendors_tenantId_idx" ON "vendors"("tenantId");

-- CreateIndex
CREATE INDEX "vendors_category_idx" ON "vendors"("category");

-- CreateIndex
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE INDEX "staff_communityId_idx" ON "staff"("communityId");

-- CreateIndex
CREATE INDEX "staff_role_idx" ON "staff"("role");

-- CreateIndex
CREATE INDEX "staff_status_idx" ON "staff"("status");

-- CreateIndex
CREATE UNIQUE INDEX "staff_communityId_employeeId_key" ON "staff"("communityId", "employeeId");

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_units" ADD CONSTRAINT "resident_units_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_units" ADD CONSTRAINT "resident_units_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

