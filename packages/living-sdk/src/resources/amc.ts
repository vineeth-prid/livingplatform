import type {
  AMCContract, AMCCoverage, AMCHistory, AMCSLARule, ListParams, Paginated,
} from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/**
 * AMC Management Engine: maintenance contracts — who is responsible, until when,
 * under what SLA, at what cost, over which assets. Execution stays in the Work
 * Order Engine; scheduling in Preventive Maintenance.
 */
export class AmcResource {
  constructor(private readonly http: HttpClient) {}

  list(params: { communityId: string } & Query): Promise<Paginated<AMCContract>> {
    return this.http.get('/amc/contracts', params);
  }
  get(id: string): Promise<AMCContract> {
    return this.http.get(`/amc/contracts/${id}`);
  }
  create(input: Body): Promise<AMCContract> {
    return this.http.post('/amc/contracts', input);
  }
  update(id: string, input: Body): Promise<AMCContract> {
    return this.http.patch(`/amc/contracts/${id}`, input);
  }
  remove(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.http.delete(`/amc/contracts/${id}`);
  }
  renew(id: string, input: { endDate: string; startDate?: string; annualCost?: number; notes?: string }): Promise<AMCContract> {
    return this.http.post(`/amc/contracts/${id}/renew`, input);
  }
  history(id: string): Promise<AMCHistory[]> {
    return this.http.get(`/amc/contracts/${id}/history`);
  }

  // Coverage
  coverages(id: string): Promise<AMCCoverage[]> {
    return this.http.get(`/amc/contracts/${id}/assets`);
  }
  addCoverage(id: string, input: Body): Promise<AMCCoverage> {
    return this.http.post(`/amc/contracts/${id}/assets`, input);
  }
  removeCoverage(id: string, assetId: string): Promise<unknown> {
    return this.http.delete(`/amc/contracts/${id}/assets/${assetId}`);
  }

  // SLA
  addSla(id: string, input: Body): Promise<AMCSLARule> {
    return this.http.post(`/amc/contracts/${id}/sla`, input);
  }
  updateSla(slaId: string, input: Body): Promise<AMCSLARule> {
    return this.http.patch(`/amc/sla/${slaId}`, input);
  }
  removeSla(slaId: string): Promise<unknown> {
    return this.http.delete(`/amc/sla/${slaId}`);
  }
}
