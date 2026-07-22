-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderOriginType" AS ENUM ('MANUAL', 'TICKET', 'SERVICE_REQUEST');

-- CreateEnum
CREATE TYPE "WorkOrderEventType" AS ENUM ('CREATED', 'ASSIGNED', 'REASSIGNED', 'ACCEPTED', 'STARTED', 'PROGRESS_UPDATED', 'ON_HOLD', 'RESUMED', 'COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "communityId" TEXT NOT NULL,
    "unitId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "assignedStaffId" TEXT,
    "assignedVendorId" TEXT,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3),
    "reassignedCount" INTEGER NOT NULL DEFAULT 0,
    "originType" "WorkOrderOriginType" NOT NULL DEFAULT 'MANUAL',
    "originId" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "startedDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "verifiedDate" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verificationRemarks" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_updates" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "progressPercent" INTEGER,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "work_order_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_attachments" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "work_order_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_timeline" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "type" "WorkOrderEventType" NOT NULL,
    "actorId" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_number_key" ON "work_orders"("number");

-- CreateIndex
CREATE INDEX "work_orders_communityId_idx" ON "work_orders"("communityId");

-- CreateIndex
CREATE INDEX "work_orders_unitId_idx" ON "work_orders"("unitId");

-- CreateIndex
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");

-- CreateIndex
CREATE INDEX "work_orders_priority_idx" ON "work_orders"("priority");

-- CreateIndex
CREATE INDEX "work_orders_assignedStaffId_idx" ON "work_orders"("assignedStaffId");

-- CreateIndex
CREATE INDEX "work_orders_assignedVendorId_idx" ON "work_orders"("assignedVendorId");

-- CreateIndex
CREATE INDEX "work_orders_originType_originId_idx" ON "work_orders"("originType", "originId");

-- CreateIndex
CREATE INDEX "work_orders_createdAt_idx" ON "work_orders"("createdAt");

-- CreateIndex
CREATE INDEX "work_order_updates_workOrderId_idx" ON "work_order_updates"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_attachments_workOrderId_idx" ON "work_order_attachments"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_timeline_workOrderId_idx" ON "work_order_timeline"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_timeline_createdAt_idx" ON "work_order_timeline"("createdAt");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_updates" ADD CONSTRAINT "work_order_updates_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_attachments" ADD CONSTRAINT "work_order_attachments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_timeline" ADD CONSTRAINT "work_order_timeline_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

