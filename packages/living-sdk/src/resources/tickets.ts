import type {
  ListParams, Paginated, Ticket, TicketAttachment, TicketCategory,
  TicketComment, TicketDashboardSummary, TimelineEvent,
} from '@living/types';

import type { HttpClient } from '../http';

type Query = ListParams & Record<string, unknown>;
type Body = Record<string, unknown>;

/** Ticket Engine: tickets, status, assignment, comments, attachments, timeline,
 *  categories and the dashboard summary. */
export class TicketResource {
  constructor(private readonly http: HttpClient) {}

  list(communityId: string, params?: Query): Promise<Paginated<Ticket>> {
    return this.http.get(`/communities/${communityId}/tickets`, params);
  }
  create(communityId: string, input: Body): Promise<Ticket> {
    return this.http.post(`/communities/${communityId}/tickets`, input);
  }
  dashboard(communityId: string): Promise<TicketDashboardSummary> {
    return this.http.get(`/communities/${communityId}/tickets/dashboard`);
  }
  get(id: string): Promise<Ticket> {
    return this.http.get(`/tickets/${id}`);
  }
  update(id: string, input: Body): Promise<Ticket> {
    return this.http.patch(`/tickets/${id}`, input);
  }
  changeStatus(id: string, status: string, note?: string): Promise<Ticket> {
    return this.http.patch(`/tickets/${id}/status`, { status, note });
  }
  assign(id: string, input: { staffId?: string; vendorId?: string; note?: string }): Promise<Ticket> {
    return this.http.put(`/tickets/${id}/assignment`, input);
  }
  remove(id: string): Promise<unknown> {
    return this.http.delete(`/tickets/${id}`);
  }
  timeline(id: string): Promise<TimelineEvent[]> {
    return this.http.get(`/tickets/${id}/timeline`);
  }

  // Comments
  listComments(id: string): Promise<TicketComment[]> {
    return this.http.get(`/tickets/${id}/comments`);
  }
  addComment(id: string, body: string, isInternal?: boolean): Promise<TicketComment> {
    return this.http.post(`/tickets/${id}/comments`, { body, isInternal });
  }

  // Attachments
  listAttachments(id: string): Promise<TicketAttachment[]> {
    return this.http.get(`/tickets/${id}/attachments`);
  }
  attachmentUploadUrl(
    id: string,
    input: { fileName: string; contentType?: string },
  ): Promise<{ key: string; uploadUrl: string; expiresAt: string }> {
    return this.http.post(`/tickets/${id}/attachments/upload-url`, input);
  }
  addAttachment(id: string, input: Body): Promise<TicketAttachment> {
    return this.http.post(`/tickets/${id}/attachments`, input);
  }

  // Categories
  listCategories(params?: { activeOnly?: boolean }): Promise<TicketCategory[]> {
    return this.http.get('/ticket-categories', params);
  }
  createCategory(input: Body): Promise<TicketCategory> {
    return this.http.post('/ticket-categories', input);
  }
  updateCategory(id: string, input: Body): Promise<TicketCategory> {
    return this.http.patch(`/ticket-categories/${id}`, input);
  }
  deleteCategory(id: string): Promise<unknown> {
    return this.http.delete(`/ticket-categories/${id}`);
  }
}
