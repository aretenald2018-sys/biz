'use client';

import { useDroppable } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileKanbanCardItem } from './file-kanban-card-item';
import type { TicketFileKanbanCard, TicketFileKanbanCategory } from '@/types/ticket-file-kanban';

interface FileKanbanSectionProps {
  category: TicketFileKanbanCategory;
  cards: TicketFileKanbanCard[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAddCard: (categoryId: string) => void;
  onEditCard: (card: TicketFileKanbanCard) => void;
  onEditCategory: (category: TicketFileKanbanCategory) => void;
}

export function FileKanbanSection({
  category,
  cards,
  collapsed,
  onToggleCollapsed,
  onAddCard,
  onEditCard,
  onEditCategory,
}: FileKanbanSectionProps) {
  const { setNodeRef } = useDroppable({
    id: category.id,
    data: {
      type: 'section',
      categoryId: category.id,
    },
  });

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left"
          onClick={onToggleCollapsed}
        >
          {collapsed ? (
            <ChevronRight className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
          <span className="truncate text-sm font-medium text-foreground">{category.name}</span>
          {category.is_default === 1 && (
            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-primary">
              DEFAULT
            </span>
          )}
          <span className="text-xs text-muted-foreground">({category.card_count || cards.length})</span>
        </button>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon-xs" variant="ghost" onClick={() => onAddCard(category.id)}>
            <Plus />
          </Button>
          <Button type="button" size="icon-xs" variant="ghost" onClick={() => onEditCategory(category)}>
            <MoreHorizontal />
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div ref={setNodeRef} className="min-h-10 rounded-md border border-dashed border-border/60 bg-muted/10 p-2">
          <SortableContext items={cards.map((card) => card.id)} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-1.5">
              {cards.map((card) => (
                <FileKanbanCardItem key={card.id} card={card} onEdit={onEditCard} />
              ))}
            </div>
          </SortableContext>
          {cards.length === 0 && (
            <div className="py-3 text-center text-[11px] text-muted-foreground">
              No files in this category.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
