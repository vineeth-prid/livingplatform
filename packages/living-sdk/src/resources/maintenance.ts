import type {
  ListParams, MaintenanceChecklistTemplate, MaintenancePlan, MaintenanceRun, Paginated,
} from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/**
 * Preventive Maintenance Engine: recurring plans that automatically generate
 * Work Orders. Execution stays in the Work Order Engine — this schedules it.
 */
export class MaintenanceResource {
  constructor(private readonly http: HttpClient) {}

  list(params: { communityId: string } & Query): Promise<Paginated<MaintenancePlan>> {
    return this.http.get('/maintenance-plans', params);
  }
  get(id: string): Promise<MaintenancePlan> {
    return this.http.get(`/maintenance-plans/${id}`);
  }
  create(input: Body): Promise<MaintenancePlan> {
    return this.http.post('/maintenance-plans', input);
  }
  update(id: string, input: Body): Promise<MaintenancePlan> {
    return this.http.patch(`/maintenance-plans/${id}`, input);
  }
  remove(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/maintenance-plans/${id}`);
  }

  /** Pause a plan (stops future generation) — isActive=false. */
  pause(id: string): Promise<MaintenancePlan> {
    return this.http.patch(`/maintenance-plans/${id}`, { isActive: false });
  }
  /** Resume a paused plan — isActive=true. */
  resume(id: string): Promise<MaintenancePlan> {
    return this.http.patch(`/maintenance-plans/${id}`, { isActive: true });
  }

  /** Generate a work order now, on demand (does not shift the schedule). */
  generateNow(id: string): Promise<MaintenanceRun> {
    return this.http.post(`/maintenance-plans/${id}/generate`, {});
  }

  // Runs (immutable history)
  runs(id: string): Promise<MaintenanceRun[]> {
    return this.http.get(`/maintenance-plans/${id}/runs`);
  }
  run(runId: string): Promise<MaintenanceRun> {
    return this.http.get(`/maintenance-runs/${runId}`);
  }

  // Checklist templates
  addChecklistItem(planId: string, input: Body): Promise<MaintenanceChecklistTemplate> {
    return this.http.post(`/maintenance-plans/${planId}/checklist`, input);
  }
  updateChecklistItem(itemId: string, input: Body): Promise<MaintenanceChecklistTemplate> {
    return this.http.patch(`/maintenance-checklists/${itemId}`, input);
  }
  removeChecklistItem(itemId: string): Promise<unknown> {
    return this.http.delete(`/maintenance-checklists/${itemId}`);
  }
}
