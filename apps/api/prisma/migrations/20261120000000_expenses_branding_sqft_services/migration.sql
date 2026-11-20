-- CreateEnum
CREATE TYPE "ChargeCalculationMethod" AS ENUM ('FIXED', 'PER_SQFT');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'WORK_ORDER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- AlterTable
ALTER TABLE "community_settings" ADD COLUMN     "servicesEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "actualLabourCost" DECIMAL(14,2),
ADD COLUMN     "actualMaterialCost" DECIMAL(14,2),
ADD COLUMN     "actualTotalCost" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "maintenance_charges" ADD COLUMN     "calculationMethod" "ChargeCalculationMethod" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "ratePerSqft" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "maintenance_invoices" ADD COLUMN     "billedAreaSqft" DECIMAL(12,2),
ADD COLUMN     "ratePerSqft" DECIMAL(10,4);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "payee" TEXT,
    "referenceNumber" TEXT,
    "paymentMethod" TEXT,
    "attachmentKey" TEXT,
    "attachmentName" TEXT,
    "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
    "workOrderId" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_categories_communityId_idx" ON "expense_categories"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_communityId_name_key" ON "expense_categories"("communityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_workOrderId_key" ON "expenses"("workOrderId");

-- CreateIndex
CREATE INDEX "expenses_communityId_expenseDate_idx" ON "expenses"("communityId", "expenseDate");

-- CreateIndex
CREATE INDEX "expenses_categoryId_idx" ON "expenses"("categoryId");

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AlterEnum
ALTER TYPE "WorkOrderEventType" ADD VALUE 'COST_RECORDED';
