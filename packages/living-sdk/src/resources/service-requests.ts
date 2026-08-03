import type {
  ListParams, Paginated, Service, ServiceFeedback, ServiceRequest,
} from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/** Service Request Engine: requests, assignment, status, scheduling, feedback,
 *  optional ticket link, and the service catalog. */
export class ServiceRequestResource {
  constructor(private readonly http: HttpClient) {}

  list(communityId: string, params?: Query): Promise<Paginated<ServiceRequest>> {
    return this.http.get(`/communities/${communityId}/service-requests`, params);
  }
  create(communityId: string, input: Body): Promise<ServiceRequest> {
    return this.http.post(`/communities/${communityId}/service-requests`, input);
  }
  get(id: string): Promise<ServiceRequest> {
    return this.http.get(`/service-requests/${id}`);
  }
  update(id: string, input: Body): Promise<ServiceRequest> {
    return this.http.patch(`/service-requests/${id}`, input);
  }
  changeStatus(id: string, status: string, note?: string): Promise<ServiceRequest> {
    return this.http.patch(`/service-requests/${id}/status`, { status, note });
  }
  assign(id: string, input: { staffId?: string; vendorId?: string; note?: string }): Promise<ServiceRequest> {
    return this.http.put(`/service-requests/${id}/assignment`, input);
  }
  schedule(id: string, input: Body): Promise<ServiceRequest> {
    return this.http.patch(`/service-requests/${id}/schedule`, input);
  }
  remove(id: string): Promise<unknown> {
    return this.http.delete(`/service-requests/${id}`);
  }

  // Ticket integration (loose)
  linkTicket(id: string, ticketId: string): Promise<ServiceRequest> {
    return this.http.post(`/service-requests/${id}/ticket/link`, { ticketId });
  }
  createTicket(id: string, input: { categoryId: string; priority?: string }): Promise<unknown> {
    return this.http.post(`/service-requests/${id}/ticket`, input);
  }

  // Feedback
  getFeedback(id: string): Promise<ServiceFeedback | null> {
    return this.http.get(`/service-requests/${id}/feedback`);
  }
  submitFeedback(id: string, input: { rating: number; comment?: string }): Promise<ServiceFeedback> {
    return this.http.post(`/service-requests/${id}/feedback`, input);
  }

  // Catalog
  listServices(params?: { activeOnly?: boolean; search?: string }): Promise<Service[]> {
    return this.http.get('/services', params);
  }
  createService(input: Body): Promise<Service> {
    return this.http.post('/services', input);
  }
  updateService(id: string, input: Body): Promise<Service> {
    return this.http.patch(`/services/${id}`, input);
  }
  /**
   * Enable / disable a service — the supported way to stop offering one.
   * Inactive services vanish from the resident app but keep every historical
   * request intact.
   */
  setServiceStatus(id: string, isActive: boolean): Promise<Service> {
    return this.http.patch(`/services/${id}/status`, { isActive });
  }

  /** Open requests + packages still referencing a service (shown before disabling). */
  serviceUsage(id: string): Promise<{ openRequests: number; packages: number }> {
    return this.http.get(`/services/${id}/usage`);
  }

  /** @deprecated Prefer `setServiceStatus(id, false)` — services are not deleted. */
  deleteService(id: string): Promise<unknown> {
    return this.http.delete(`/services/${id}`);
  }
}
