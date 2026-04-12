'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KanbanCardItem } from './kanban-card-item';
import type { KanbanCategory } from '@/types/kanban';
import type { Ticket } from '@/types/ticket';

interface KanbanColumnProps {
  category: KanbanCategory;
  tickets: Ticket[];
  onAddCard: (categoryId: string) => void;
  onEditTicket: (ticket: Ticket) => void;
  onEditCategory: (category: KanbanCategory) => void;
}

export function KanbanColumn({
  category,
  tickets,
  onAddCard,
  onEditTicket,
  onEditCategory,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: category.id,
    data: {
      type: 'column',
      categoryId: category.id,
    },
  });

  return (
    <div ref={setNodeRef} className="flex h-full min-w-[280px] flex-col rounded-xl border border-border bg-muted/20">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
          <div>
            <h3 className="text-base font-medium text-foreground">{category.name}</h3>
            <p className="text-xs text-muted-foreground">{tickets.length} tickets</p>
          </div>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => onEditCategory(category)}>
          <MoreHorizontal />
        </Button>
      </div>
      <div className="flex-1 space-y-3 p-3">
        <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
          {tickets.map((ticket) => (
            <KanbanCardItem key={ticket.id} ticket={ticket} onEdit={onEditTicket} />
          ))}
        </SortableContext>
        {tickets.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            No tickets in this category.
          </div>
        )}
      </div>
      <div className="border-t border-border p-3">
        <Button type="button" variant="outline" className="w-full" onClick={() => onAddCard(category.id)}>
          <Plus />
          Add ticket
        </Button>
      </div>
    </div>
  );
}
