import type {
  ListParams, Paginated, TimelineEvent, WorkOrder, WorkOrderAttachment, WorkOrderUpdate,
} from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/** Work Order Engine: work orders, assignment, status, progress updates,
 *  verification, attachments and timeline. */
export class WorkOrderResource {
  constructor(private readonly http: HttpClient) {}

  list(communityId: string, params?: Query): Promise<Paginated<WorkOrder>> {
    return this.http.get(`/communities/${communityId}/work-orders`, params);
  }
  create(communityId: string, input: Body): Promise<WorkOrder> {
    return this.http.post(`/communities/${communityId}/work-orders`, input);
  }
  get(id: string): Promise<WorkOrder> {
    return this.http.get(`/work-orders/${id}`);
  }
  update(id: string, input: Body): Promise<WorkOrder> {
    return this.http.patch(`/work-orders/${id}`, input);
  }
  changeStatus(id: string, status: string, note?: string): Promise<WorkOrder> {
    return this.http.patch(`/work-orders/${id}/status`, { status, note });
  }
  assign(id: string, input: { staffId?: string; vendorId?: string; note?: string }): Promise<WorkOrder> {
    return this.http.put(`/work-orders/${id}/assignment`, input);
  }
  verify(id: string, remarks?: string): Promise<WorkOrder> {
    return this.http.post(`/work-orders/${id}/verify`, { remarks });
  }
  remove(id: string): Promise<unknown> {
    return this.http.delete(`/work-orders/${id}`);
  }
  timeline(id: string): Promise<TimelineEvent[]> {
    return this.http.get(`/work-orders/${id}/timeline`);
  }

  // Progress updates
  listUpdates(id: string): Promise<WorkOrderUpdate[]> {
    return this.http.get(`/work-orders/${id}/updates`);
  }
  addUpdate(
    id: string,
    input: { comment: string; progressPercent?: number; isInternal?: boolean },
  ): Promise<WorkOrderUpdate> {
    return this.http.post(`/work-orders/${id}/updates`, input);
  }

  // Attachments
  listAttachments(id: string): Promise<WorkOrderAttachment[]> {
    return this.http.get(`/work-orders/${id}/attachments`);
  }
  attachmentUploadUrl(
    id: string,
    input: { fileName: string; contentType?: string },
  ): Promise<{ key: string; uploadUrl: string; expiresAt: string }> {
    return this.http.post(`/work-orders/${id}/attachments/upload-url`, input);
  }
  addAttachment(id: string, input: Body): Promise<WorkOrderAttachment> {
    return this.http.post(`/work-orders/${id}/attachments`, input);
  }
}
