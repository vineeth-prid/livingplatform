import { Module } from '@nestjs/common';

import { WorkOrderModule } from '../work-order/work-order.module';
import {
  MaintenanceChecklistController,
  MaintenancePlanController,
  MaintenanceRunController,
} from './maintenance.controllers';
import { MaintenanceChecklistService } from './maintenance-checklist.service';
import { MaintenanceGenerationService } from './maintenance-generation.service';
import { MaintenancePlanService } from './maintenance-plan.service';
import { MaintenanceRunService } from './maintenance-run.service';
import { MaintenanceSchedulerService } from './maintenance-scheduler.service';

/**
 * Preventive Maintenance Engine (Sprint 8) — the platform's automation layer. It
 * decides WHEN maintenance is due and generates Work Orders through the existing
 * Work Order Engine; it never executes. Imports WorkOrderModule to consume
 * WorkOrderService (resolved per-generation via ModuleRef, since it is
 * request-scoped). Depends on the Asset Engine's data, the shared tenancy,
 * events, audit and RBAC — no duplicated workflow, assignment, status or timeline.
 */
@Module({
  imports: [WorkOrderModule],
  controllers: [
    MaintenancePlanController,
    MaintenanceChecklistController,
    MaintenanceRunController,
  ],
  providers: [
    MaintenancePlanService,
    MaintenanceChecklistService,
    MaintenanceRunService,
    MaintenanceGenerationService,
    MaintenanceSchedulerService,
  ],
  exports: [MaintenancePlanService],
})
export class MaintenanceModule {}
