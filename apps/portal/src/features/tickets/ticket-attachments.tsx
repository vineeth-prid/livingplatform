import { useRef } from 'react';
import { Download, Paperclip } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { LivingApiError } from '@living/living-sdk';
import { formatFileSize } from '@living/utils';
import { Button, EmptyState, toast } from '@living/ui';
import type { TicketAttachment } from '@living/types';

import { useAddAttachment } from './queries';

/**
 * Attachments: list + download, and (with ticket:comment) register new files via
 * StorageService's signed-URL flow. No delete — the backend has no delete
 * endpoint for ticket attachments.
 */
export function TicketAttachments({
  ticketId, attachments,
}: {
  ticketId: string;
  attachments: TicketAttachment[];
}) {
  const { hasPermission } = useAuth();
  const add = useAddAttachment(ticketId);
  const inputRef = useRef<HTMLInputElement>(null);
  const canAdd = hasPermission('ticket:comment');

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      for (const file of Array.from(files)) await add.mutateAsync(file);
      toast.success('Attachment added');
    } catch (err) {
      toast.error(err instanceof LivingApiError ? err.message : 'Could not add attachment');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {attachments.length === 0 ? (
        <EmptyState icon={Paperclip} title="No attachments" />
      ) : (
        <ul className="flex flex-col gap-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-sunken">
              <Paperclip className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-strong">{a.fileName}</p>
                <p className="text-xs text-subtle">{formatFileSize(a.size)}</p>
              </div>
              {a.downloadUrl && (
                <a
                  href={a.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-tint hover:text-brand"
                  aria-label={`Download ${a.fileName}`}
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
          <Button variant="secondary" size="sm" loading={add.isPending} onClick={() => inputRef.current?.click()}>
            <Paperclip className="h-4 w-4" /> Attach files
          </Button>
        </div>
      )}
    </div>
  );
}
