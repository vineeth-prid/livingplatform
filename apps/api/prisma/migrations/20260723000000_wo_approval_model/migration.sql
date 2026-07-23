-- Work Order Approval Model — a Work Order is APPROVED work.
-- Additive only: new enum values + approval/financial columns. No data rewrite.

-- AlterEnum: approval-lane statuses
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- AlterEnum: AMC origin
ALTER TYPE "WorkOrderOriginType" ADD VALUE IF NOT EXISTS 'AMC';

-- AlterEnum: approval timeline events
ALTER TYPE "WorkOrderEventType" ADD VALUE IF NOT EXISTS 'RECOMMENDED';
ALTER TYPE "WorkOrderEventType" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "WorkOrderEventType" ADD VALUE IF NOT EXISTS 'REJECTED';

-- AlterTable: approval + financial fields
ALTER TABLE "work_orders"
  ADD COLUMN "requestedById"         TEXT,
  ADD COLUMN "requestedDate"         TIMESTAMP(3),
  ADD COLUMN "recommendedById"       TEXT,
  ADD COLUMN "approvedById"          TEXT,
  ADD COLUMN "approvedDate"          TIMESTAMP(3),
  ADD COLUMN "rejectionReason"       TEXT,
  ADD COLUMN "estimatedLabourCost"   DECIMAL(14,2),
  ADD COLUMN "estimatedMaterialCost" DECIMAL(14,2),
  ADD COLUMN "estimatedTotalCost"    DECIMAL(14,2);
