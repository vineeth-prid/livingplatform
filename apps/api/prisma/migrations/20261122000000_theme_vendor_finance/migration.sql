-- CreateEnum
CREATE TYPE "CommissionModel" AS ENUM ('PERCENTAGE', 'FIXED', 'NONE');

-- CreateEnum
CREATE TYPE "PayoutFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "VendorPayoutStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "community_settings" ADD COLUMN     "theme" JSONB;

-- CreateTable
CREATE TABLE "vendor_commission_configs" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceId" TEXT,
    "model" "CommissionModel" NOT NULL,
    "rate" DECIMAL(7,4),
    "fixedAmount" DECIMAL(14,2),
    "payoutFrequency" "PayoutFrequency" NOT NULL DEFAULT 'MONTHLY',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "vendor_commission_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payouts" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "frequency" "PayoutFrequency" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "serviceValue" DECIMAL(14,2) NOT NULL,
    "commission" DECIMAL(14,2) NOT NULL,
    "payable" DECIMAL(14,2) NOT NULL,
    "status" "VendorPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(14,2),
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "paymentMethod" TEXT,
    "paidById" TEXT,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "vendorInvoiceNumber" TEXT,
    "vendorInvoiceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "vendor_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payout_lines" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "basis" TEXT NOT NULL,
    "serviceValue" DECIMAL(14,2) NOT NULL,
    "commissionModel" "CommissionModel" NOT NULL,
    "commissionRate" DECIMAL(7,4),
    "commission" DECIMAL(14,2) NOT NULL,
    "payable" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "vendor_payout_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_commission_configs_communityId_vendorId_idx" ON "vendor_commission_configs"("communityId", "vendorId");

-- CreateIndex
CREATE INDEX "vendor_payouts_communityId_vendorId_status_idx" ON "vendor_payouts"("communityId", "vendorId", "status");

-- CreateIndex
CREATE INDEX "vendor_payouts_communityId_periodStart_idx" ON "vendor_payouts"("communityId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_payouts_communityId_number_key" ON "vendor_payouts"("communityId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_payout_lines_serviceRequestId_key" ON "vendor_payout_lines"("serviceRequestId");

-- CreateIndex
CREATE INDEX "vendor_payout_lines_payoutId_idx" ON "vendor_payout_lines"("payoutId");

-- AddForeignKey
ALTER TABLE "vendor_commission_configs" ADD CONSTRAINT "vendor_commission_configs_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_commission_configs" ADD CONSTRAINT "vendor_commission_configs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payouts" ADD CONSTRAINT "vendor_payouts_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payouts" ADD CONSTRAINT "vendor_payouts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payout_lines" ADD CONSTRAINT "vendor_payout_lines_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "vendor_payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payout_lines" ADD CONSTRAINT "vendor_payout_lines_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
