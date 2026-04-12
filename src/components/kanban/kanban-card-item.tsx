'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Ticket } from '@/types/ticket';

interface KanbanCardItemProps {
  ticket: Ticket;
  onEdit: (ticket: Ticket) => void;
}

export function KanbanCardItem({ ticket, onEdit }: KanbanCardItemProps) {
  const router = useRouter();
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: {
      type: 'card',
      ticket,
      categoryId: ticket.category_id,
    },
  });

  const openTicket = () => {
    router.push(`/tickets/${ticket.id}`);
  };

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
      className="cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-colors hover:border-neon-cyan/30 hover:bg-white/[0.03]"
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
          <div className="font-medium text-foreground">{ticket.title}</div>
          {ticket.description && <p className="mt-1 text-sm text-muted-foreground">{ticket.description}</p>}
        </button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(ticket);
          }}
        >
          <Pencil />
        </Button>
      </div>
    </div>
  );
}
