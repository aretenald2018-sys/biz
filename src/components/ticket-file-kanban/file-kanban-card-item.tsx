'use client';

import { useRef } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Download, Paperclip, Pencil } from 'lucide-react';
import type { TicketFileKanbanCard } from '@/types/ticket-file-kanban';

interface FileKanbanCardItemProps {
  card: TicketFileKanbanCard;
  onEdit: (card: TicketFileKanbanCard) => void;
}

export function FileKanbanCardItem({ card, onEdit }: FileKanbanCardItemProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
      categoryId: card.category_id,
    },
  });

  const downloadUrl = card.email_attachment_id ? `/api/email-attachments/${card.email_attachment_id}` : null;
  const displayName = card.file_name.length > 20 ? `${card.file_name.slice(0, 20)}...` : card.file_name;
  const tooltip = [
    card.file_name,
    card.source_email_subject ? `Email: ${card.source_email_subject}` : null,
    card.source_email_sender_name || card.source_email_sender_email
      ? `From: ${card.source_email_sender_name || card.source_email_sender_email}`
      : null,
  ].filter(Boolean).join('\n');

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;

    const delta = Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y);
    if (delta < 5) {
      if (downloadUrl) {
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        onEdit(card);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      title={tooltip}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs shadow-sm transition-colors hover:border-neon-cyan/30"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        startRef.current = null;
      }}
      {...attributes}
      {...listeners}
    >
      {card.email_attachment_id && card.is_image === 1 && (
        <img
          src={`/api/email-attachments/${card.email_attachment_id}`}
          alt={card.file_name}
          className="size-4 rounded object-cover"
        />
      )}
      {!card.email_attachment_id || card.is_image !== 1 ? (
        <Paperclip className="size-3.5 text-muted-foreground" />
      ) : null}

      <span className="max-w-[10rem] truncate font-medium text-foreground">
        {displayName}
      </span>

      {downloadUrl && (
        <a
          href={downloadUrl}
          download={card.file_name}
          onClick={(event) => event.stopPropagation()}
          className="ml-auto text-neon-cyan/80 hover:text-neon-cyan"
          aria-label={`Download ${card.file_name}`}
        >
          <Download className="size-3.5" />
        </a>
      )}
      {!downloadUrl && (
        <button
          type="button"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(card);
          }}
          aria-label={`Edit ${card.file_name}`}
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      {downloadUrl && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(card);
          }}
          aria-label={`Edit ${card.file_name}`}
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      {card.description && (
        <span className="sr-only">{card.description}</span>
      )}
    </div>
  );
}
