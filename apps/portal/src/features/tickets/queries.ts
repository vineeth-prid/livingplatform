import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@living/hooks';
import type { Ticket, TicketStatus } from '@living/types';

import { living } from '../../lib/living';

const ticketKey = (id: string) => ['ticket', id] as const;

/** Full ticket detail (backend `get` includes category, unit, resident, assignee,
 *  comments, attachments, timeline). */
export function useTicket(id: string) {
  return useQuery({ queryKey: ticketKey(id), queryFn: () => living.ticket.get(id) });
}

/** Ticket categories (system + tenant) for filters and the create/edit form. */
export function useTicketCategories() {
  return useQuery({
    queryKey: ['ticket-categories', 'active'],
    queryFn: () => living.ticket.listCategories({ activeOnly: true }),
    staleTime: 5 * 60_000,
  });
}

/** Ticket mutations, keyed to invalidate the right caches. Status change is
 *  optimistic for an instant, calm feel; rolls back on error. */
export function useTicketMutations(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ticketKey(id) });
    void qc.invalidateQueries({ queryKey: ['tickets'] });
  };

  const changeStatus = useMutation({
    mutationFn: (input: { status: TicketStatus; note?: string }) =>
      living.ticket.changeStatus(id, input.status, input.note),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ticketKey(id) });
      const previous = qc.getQueryData<Ticket>(ticketKey(id));
      if (previous) qc.setQueryData<Ticket>(ticketKey(id), { ...previous, status: input.status });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(ticketKey(id), ctx.previous);
    },
    onSettled: invalidate,
  });

  const assign = useMutation({
    mutationFn: (input: { staffId?: string; vendorId?: string; note?: string }) =>
      living.ticket.assign(id, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) => living.ticket.update(id, input),
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: (input: { body: string; isInternal?: boolean }) =>
      living.ticket.addComment(id, input.body, input.isInternal),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => living.ticket.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tickets'] }),
  });

  return { changeStatus, assign, update, addComment, remove };
}

/** Register an attachment: get a signed key from StorageService, then record
 *  metadata. Byte upload wires in when a real storage provider replaces the stub. */
export function useAddAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const signed = await living.ticket.attachmentUploadUrl(id, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      });
      // ponytail: storage is a metadata-only stub this phase — skip the PUT of
      // bytes; register the attachment record so it appears. Add the PUT when a
      // real provider lands (uploadUrl becomes a real target).
      return living.ticket.addAttachment(id, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        storageKey: signed.key,
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ticketKey(id) }),
  });
}

/** Staff (community) + vendors (tenant) for the assignment picker. */
export function useAssignees(communityId: string | null) {
  const staff = useQuery({
    queryKey: [...qk.staff(communityId ?? '', 'assignable')],
    queryFn: () => living.people.listStaff(communityId!, { limit: 100, status: 'ACTIVE' }),
    enabled: !!communityId,
  });
  const vendors = useQuery({
    queryKey: qk.vendors('assignable'),
    queryFn: () => living.people.listVendors({ limit: 100, status: 'ACTIVE' }),
  });
  return { staff, vendors };
}
