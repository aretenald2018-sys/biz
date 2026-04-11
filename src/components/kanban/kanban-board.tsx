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
import type { KanbanCard, KanbanCategory } from '@/types/kanban';

function getCategoryIdFromTarget(target: DragEndEvent['over'] | DragOverEvent['over'], cards: KanbanCard[]) {
  const data = target?.data.current;
  if (data?.type === 'card') return data.card.category_id as string;
  const targetId = String(target?.id || '');
  const existingCard = cards.find((card) => card.id === targetId);
  return existingCard?.category_id ?? targetId;
}

function getTargetPosition(target: DragEndEvent['over'] | DragOverEvent['over'], cards: KanbanCard[], categoryId: string) {
  const targetId = String(target?.id || '');
  const siblingCards = cards.filter((card) => card.category_id === categoryId).sort((a, b) => a.position - b.position);
  const targetIndex = siblingCards.findIndex((card) => card.id === targetId);
  return targetIndex >= 0 ? targetIndex : siblingCards.length;
}

export function KanbanBoard() {
  const {
    categories,
    cards,
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
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
  const [editingCategory, setEditingCategory] = useState<KanbanCategory | null>(null);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cardsByCategory = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const category of categories) {
      map.set(category.id, cards.filter((card) => card.category_id === category.id).sort((a, b) => a.position - b.position));
    }
    return map;
  }, [categories, cards]);

  const handleDragStart = (event: DragStartEvent) => {
    const active = cards.find((card) => card.id === String(event.active.id));
    if (active) {
      setCardFormCategoryId(active.category_id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const over = event.over;
    if (!over) return;

    const active = cards.find((card) => card.id === activeId);
    if (!active) return;

    const targetCategoryId = getCategoryIdFromTarget(over, cards);
    if (!targetCategoryId) return;

    const targetPosition = getTargetPosition(over, cards, targetCategoryId);
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

  const handleSaveCard = async (input: {
    category_id: string;
    title: string;
    description?: string | null;
    ticket_id?: string | null;
  }) => {
    const cleaned = {
      ...input,
      description: input.description ?? undefined,
      ticket_id: input.ticket_id ?? undefined,
    };
    if (editingCard) {
      await updateCard(editingCard.id, cleaned);
      return;
    }
    await createCard(cleaned);
  };

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">칸반 보드</h2>
          <p className="text-sm text-muted-foreground">카테고리 CRUD, 카드 드래그 이동, 티켓 연결을 지원합니다.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingCategory(null);
            setCategoryFormOpen(true);
          }}
        >
          카테고리 추가
        </Button>
      </div>

      <div className="overflow-x-auto p-5">
        {loading && categories.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">칸반 보드를 불러오는 중입니다.</div>
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
                  cards={cardsByCategory.get(category.id) || []}
                  onAddCard={(categoryId) => {
                    setCardFormCategoryId(categoryId);
                    setEditingCard(null);
                    setCardFormOpen(true);
                  }}
                  onEditCard={(card) => {
                    setEditingCard(card);
                    setCardFormCategoryId(card.category_id);
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
                  카테고리를 먼저 추가하세요.
                </div>
              )}
            </div>
          </DndContext>
        )}
      </div>

      <KanbanCardForm
        open={cardFormOpen}
        initialCategoryId={cardFormCategoryId || categories[0]?.id || ''}
        card={editingCard}
        onOpenChange={setCardFormOpen}
        onSubmit={handleSaveCard}
        onDelete={editingCard ? async () => deleteCard(editingCard.id, editingCard.ticket_id) : undefined}
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
