'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { KanbanCard } from '@/types/kanban';

interface KanbanCardItemProps {
  card: KanbanCard;
  onEdit: (card: KanbanCard) => void;
}

export function KanbanCardItem({ card, onEdit }: KanbanCardItemProps) {
  const router = useRouter();
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
      categoryId: card.category_id,
    },
  });

  const openTicket = () => {
    if (card.ticket_id) {
      router.push(`/tickets/${card.ticket_id}`);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || !card.ticket_id) return;

    const delta = Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y);
    if (delta < 5) {
      openTicket();
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
      className={`rounded-lg border border-border bg-card p-3 shadow-sm transition-colors ${
        card.ticket_id ? 'cursor-pointer hover:border-neon-cyan/30 hover:bg-white/[0.03]' : ''
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        startRef.current = null;
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="flex-1 cursor-grab text-left active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <div className="font-medium text-foreground">{card.title}</div>
          {card.description && <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>}
        </button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(card);
          }}
        >
          <Pencil />
        </Button>
      </div>

      {card.ticket_title && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            openTicket();
          }}
          className="mt-3 inline-flex items-center rounded-full bg-[#EDF2FF] px-2.5 py-1 text-[11px] text-[#002C5F] transition-colors hover:bg-[#dbe6ff] hover:text-[#001f45]"
        >
          티켓: {card.ticket_title} {card.ticket_status ? `(${card.ticket_status})` : ''}
        </button>
      )}
    </div>
  );
}
