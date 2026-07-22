-- AlterEnum (additive — the new value is not used within this migration)
ALTER TYPE "WorkOrderOriginType" ADD VALUE 'PREVENTIVE_MAINTENANCE';

-- CreateEnum
CREATE TYPE "MaintenanceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MaintenanceRunStatus" AS ENUM ('SCHEDULED', 'GENERATED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "maintenance_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequencyType" "MaintenanceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "frequencyInterval" INTEGER NOT NULL DEFAULT 1,
    "cronExpression" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimatedDurationMinutes" INTEGER,
    "requiresVerification" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_checklist_templates" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "maintenance_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_runs" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "generatedWorkOrderId" TEXT,
    "status" "MaintenanceRunStatus" NOT NULL DEFAULT 'SCHEDULED',
    "generationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_plans_tenantId_idx" ON "maintenance_plans"("tenantId");

-- CreateIndex
CREATE INDEX "maintenance_plans_communityId_idx" ON "maintenance_plans"("communityId");

-- CreateIndex
CREATE INDEX "maintenance_plans_assetId_idx" ON "maintenance_plans"("assetId");

-- CreateIndex
CREATE INDEX "maintenance_plans_isActive_idx" ON "maintenance_plans"("isActive");

-- CreateIndex
CREATE INDEX "maintenance_plans_nextRunAt_idx" ON "maintenance_plans"("nextRunAt");

-- CreateIndex
CREATE INDEX "maintenance_checklist_templates_planId_idx" ON "maintenance_checklist_templates"("planId");

-- CreateIndex
CREATE INDEX "maintenance_runs_planId_idx" ON "maintenance_runs"("planId");

-- CreateIndex
CREATE INDEX "maintenance_runs_status_idx" ON "maintenance_runs"("status");

-- CreateIndex
CREATE INDEX "maintenance_runs_createdAt_idx" ON "maintenance_runs"("createdAt");

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_checklist_templates" ADD CONSTRAINT "maintenance_checklist_templates_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_runs" ADD CONSTRAINT "maintenance_runs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
