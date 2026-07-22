-- CreateEnum
CREATE TYPE "AMCStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWAL_PENDING');

-- CreateEnum
CREATE TYPE "CoverageType" AS ENUM ('FULL', 'PARTIAL', 'LABOUR_ONLY', 'PARTS_ONLY', 'INSPECTION_ONLY');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AMCEventType" AS ENUM ('CREATED', 'UPDATED', 'ACTIVATED', 'RENEWED', 'EXPIRED', 'TERMINATED', 'ASSET_ADDED', 'ASSET_REMOVED');

-- CreateTable
CREATE TABLE "amc_contracts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AMCStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "renewalReminderDays" INTEGER NOT NULL DEFAULT 30,
    "annualCost" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentFrequency" "PaymentFrequency" NOT NULL DEFAULT 'YEARLY',
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "amc_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amc_coverages" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "coverageType" "CoverageType" NOT NULL DEFAULT 'FULL',
    "responseTimeHours" INTEGER,
    "resolutionTimeHours" INTEGER,
    "visitFrequency" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amc_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amc_sla_rules" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "responseTimeMinutes" INTEGER NOT NULL,
    "resolutionTimeMinutes" INTEGER NOT NULL,
    "escalationAfterMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "amc_sla_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amc_history" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "eventType" "AMCEventType" NOT NULL,
    "description" TEXT,
    "performedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amc_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "amc_contracts_tenantId_contractNumber_key" ON "amc_contracts"("tenantId", "contractNumber");

-- CreateIndex
CREATE INDEX "amc_contracts_tenantId_idx" ON "amc_contracts"("tenantId");

-- CreateIndex
CREATE INDEX "amc_contracts_communityId_idx" ON "amc_contracts"("communityId");

-- CreateIndex
CREATE INDEX "amc_contracts_vendorId_idx" ON "amc_contracts"("vendorId");

-- CreateIndex
CREATE INDEX "amc_contracts_status_idx" ON "amc_contracts"("status");

-- CreateIndex
CREATE INDEX "amc_contracts_endDate_idx" ON "amc_contracts"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "amc_coverages_contractId_assetId_key" ON "amc_coverages"("contractId", "assetId");

-- CreateIndex
CREATE INDEX "amc_coverages_contractId_idx" ON "amc_coverages"("contractId");

-- CreateIndex
CREATE INDEX "amc_coverages_assetId_idx" ON "amc_coverages"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "amc_sla_rules_contractId_priority_key" ON "amc_sla_rules"("contractId", "priority");

-- CreateIndex
CREATE INDEX "amc_sla_rules_contractId_idx" ON "amc_sla_rules"("contractId");

-- CreateIndex
CREATE INDEX "amc_history_contractId_idx" ON "amc_history"("contractId");

-- CreateIndex
CREATE INDEX "amc_history_createdAt_idx" ON "amc_history"("createdAt");

-- AddForeignKey
ALTER TABLE "amc_contracts" ADD CONSTRAINT "amc_contracts_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_contracts" ADD CONSTRAINT "amc_contracts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_coverages" ADD CONSTRAINT "amc_coverages_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "amc_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_coverages" ADD CONSTRAINT "amc_coverages_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_sla_rules" ADD CONSTRAINT "amc_sla_rules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "amc_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_history" ADD CONSTRAINT "amc_history_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "amc_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
