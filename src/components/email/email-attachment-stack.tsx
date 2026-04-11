'use client';

import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { Attachment } from '@/types/annotation';
import type { EmailAttachment } from '@/types/email';
import { useAnnotationStore } from '@/stores/annotation-store';

export function AttachmentList({
  attachments,
  ticketId,
  parentType,
  parentId,
}: {
  attachments: Attachment[];
  ticketId: string;
  parentType: 'annotation' | 'meta_annotation';
  parentId: string;
}) {
  const { uploadAttachment, deleteAttachment } = useAnnotationStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i += 1) {
      await uploadAttachment(ticketId, parentType, parentId, files[i]);
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="mt-1.5">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="mb-1.5">
          {attachment.is_image ? (
            <div className="relative group">
              <img
                src={`/api/attachments/${attachment.id}`}
                alt={attachment.file_name}
                className="max-w-full rounded border border-surface-border"
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteAttachment(ticketId, attachment.id);
                }}
                className="absolute top-1 right-1 hidden group-hover:block text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded"
              >
                x
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px]">
              <a
                href={`/api/attachments/${attachment.id}`}
                download={attachment.file_name}
                className="text-accent-primary hover:underline truncate"
                onClick={(event) => event.stopPropagation()}
              >
                ATT {attachment.file_name}
              </a>
              <span className="text-soft-muted">({(attachment.file_size / 1024).toFixed(1)}KB)</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteAttachment(ticketId, attachment.id);
                }}
                className="text-soft-muted hover:text-accent-red"
              >
                x
              </button>
            </div>
          )}
        </div>
      ))}
      <label className="inline-flex items-center gap-1 text-[9px] text-soft-muted hover:text-accent-primary cursor-pointer mt-0.5 transition-colors">
        + ATTACH
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUpload}
          onClick={(event) => event.stopPropagation()}
        />
      </label>
    </div>
  );
}

export function EmailAttachmentStack({ attachments }: { attachments: EmailAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="border-b border-border px-4 py-3 bg-muted/20">
      <div className="text-[10px] text-primary tracking-widest font-bold mb-2">ATTACHMENTS ({attachments.length})</div>
      <div className="flex flex-wrap gap-3">
        {attachments.map((attachment) => (
          <a
            key={attachment.id}
            href={`/api/email-attachments/${attachment.id}`}
            download={attachment.file_name}
            onClick={(event) => event.stopPropagation()}
            className="group flex items-center gap-2 p-2 rounded-lg border border-border bg-card hover:border-primary/40 transition-all max-w-[240px]"
          >
            {attachment.is_image ? (
              <img
                src={`/api/email-attachments/${attachment.id}`}
                alt={attachment.file_name}
                className="w-12 h-12 object-cover rounded border border-surface-border flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 flex items-center justify-center rounded bg-muted/50 text-muted-foreground text-[10px] font-bold flex-shrink-0">
                {attachment.file_name.split('.').pop()?.toUpperCase() || 'FILE'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-foreground truncate group-hover:text-primary transition-colors">{attachment.file_name}</div>
              <div className="text-[9px] text-muted-foreground">{(attachment.file_size / 1024).toFixed(1)} KB</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
