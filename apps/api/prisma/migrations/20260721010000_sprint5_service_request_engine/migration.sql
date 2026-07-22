-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "estimatedDurationMinutes" INTEGER,
    "iconKey" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "communityId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "residentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "assignedStaffId" TEXT,
    "assignedVendorId" TEXT,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3),
    "reassignedCount" INTEGER NOT NULL DEFAULT 0,
    "preferredDate" TIMESTAMP(3),
    "preferredTimeSlot" TEXT,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "ticketId" TEXT,
    "completedDate" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_feedback" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_tenantId_idx" ON "services"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "services_tenantId_key_key" ON "services"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_number_key" ON "service_requests"("number");

-- CreateIndex
CREATE INDEX "service_requests_communityId_idx" ON "service_requests"("communityId");

-- CreateIndex
CREATE INDEX "service_requests_unitId_idx" ON "service_requests"("unitId");

-- CreateIndex
CREATE INDEX "service_requests_residentId_idx" ON "service_requests"("residentId");

-- CreateIndex
CREATE INDEX "service_requests_serviceId_idx" ON "service_requests"("serviceId");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_requests_priority_idx" ON "service_requests"("priority");

-- CreateIndex
CREATE INDEX "service_requests_assignedStaffId_idx" ON "service_requests"("assignedStaffId");

-- CreateIndex
CREATE INDEX "service_requests_assignedVendorId_idx" ON "service_requests"("assignedVendorId");

-- CreateIndex
CREATE INDEX "service_requests_ticketId_idx" ON "service_requests"("ticketId");

-- CreateIndex
CREATE INDEX "service_requests_createdAt_idx" ON "service_requests"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_feedback_serviceRequestId_key" ON "service_feedback"("serviceRequestId");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_feedback" ADD CONSTRAINT "service_feedback_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

