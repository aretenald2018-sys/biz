'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { useKanbanStore } from '@/stores/kanban-store';
import { KanbanCardForm } from './kanban-card-form';
import { KanbanCategoryForm } from './kanban-category-form';
import { KanbanColumn } from './kanban-column';
import type { KanbanCategory } from '@/types/kanban';
import type { Ticket } from '@/types/ticket';

function getCategoryIdFromTarget(target: DragEndEvent['over'] | DragOverEvent['over'], tickets: Ticket[]) {
  const data = target?.data.current;
  if (data?.type === 'card') return data.ticket.category_id as string;
  const targetId = String(target?.id || '');
  const existingTicket = tickets.find((ticket) => ticket.id === targetId);
  return existingTicket?.category_id ?? targetId;
}

function getTargetPosition(target: DragEndEvent['over'] | DragOverEvent['over'], tickets: Ticket[], categoryId: string) {
  const targetId = String(target?.id || '');
  const siblingTickets = tickets.filter((ticket) => ticket.category_id === categoryId).sort((a, b) => a.position - b.position);
  const targetIndex = siblingTickets.findIndex((ticket) => ticket.id === targetId);
  return targetIndex >= 0 ? targetIndex : siblingTickets.length;
}

export function KanbanBoard() {
  const {
    categories,
    tickets,
    loading,
    fetchBoard,
    createCategory,
    updateCategory,
    deleteCategory,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
  } = useKanbanStore();
  const [cardFormCategoryId, setCardFormCategoryId] = useState('');
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editingCategory, setEditingCategory] = useState<KanbanCategory | null>(null);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const ticketsByCategory = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const category of categories) {
      map.set(category.id, tickets.filter((ticket) => ticket.category_id === category.id).sort((a, b) => a.position - b.position));
    }
    return map;
  }, [categories, tickets]);

  const handleDragStart = (event: DragStartEvent) => {
    const active = tickets.find((ticket) => ticket.id === String(event.active.id));
    if (active?.category_id) {
      setCardFormCategoryId(active.category_id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const over = event.over;
    if (!over) return;

    const active = tickets.find((ticket) => ticket.id === activeId);
    if (!active || !active.category_id) return;

    const targetCategoryId = getCategoryIdFromTarget(over, tickets);
    if (!targetCategoryId) return;

    const targetPosition = getTargetPosition(over, tickets, targetCategoryId);
    if (active.category_id === targetCategoryId && active.position === targetPosition) return;

    void moveCard(active.id, targetCategoryId, targetPosition);
  };

  const handleCreateCategory = async (input: { name: string; color: string }) => {
    if (editingCategory) {
      await updateCategory(editingCategory.id, input);
      return;
    }
    await createCategory(input);
  };

  const handleDeleteCategory = editingCategory ? async () => deleteCategory(editingCategory.id) : undefined;

  const handleSaveTicket = async (input: {
    category_id: string;
    title: string;
    description?: string | null;
  }) => {
    const cleaned = {
      ...input,
      description: input.description ?? undefined,
    };
    if (editingTicket) {
      await updateCard(editingTicket.id, cleaned);
      return;
    }
    await createCard(cleaned);
  };

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">Kanban Board</h2>
          <p className="text-sm text-muted-foreground">Tickets are the source of truth for both the board and detail pages.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingCategory(null);
            setCategoryFormOpen(true);
          }}
        >
          Add category
        </Button>
      </div>

      <div className="overflow-x-auto p-5">
        {loading && categories.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading board...</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex min-h-[360px] gap-4">
              {categories.map((category) => (
                <KanbanColumn
                  key={category.id}
                  category={category}
                  tickets={ticketsByCategory.get(category.id) || []}
                  onAddCard={(categoryId) => {
                    setCardFormCategoryId(categoryId);
                    setEditingTicket(null);
                    setCardFormOpen(true);
                  }}
                  onEditTicket={(ticket) => {
                    setEditingTicket(ticket);
                    setCardFormCategoryId(ticket.category_id || category.id);
                    setCardFormOpen(true);
                  }}
                  onEditCategory={(categoryValue) => {
                    setEditingCategory(categoryValue);
                    setCategoryFormOpen(true);
                  }}
                />
              ))}
              {categories.length === 0 && (
                <div className="flex min-h-[300px] w-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                  Create a category first.
                </div>
              )}
            </div>
          </DndContext>
        )}
      </div>

      <KanbanCardForm
        open={cardFormOpen}
        categories={categories}
        initialCategoryId={cardFormCategoryId || categories[0]?.id || ''}
        ticket={editingTicket}
        onOpenChange={setCardFormOpen}
        onSubmit={handleSaveTicket}
        onDelete={editingTicket ? async () => deleteCard(editingTicket.id) : undefined}
      />

      <KanbanCategoryForm
        open={categoryFormOpen}
        category={editingCategory}
        onOpenChange={setCategoryFormOpen}
        onSubmit={handleCreateCategory}
        onDelete={handleDeleteCategory}
      />
    </section>
  );
}
