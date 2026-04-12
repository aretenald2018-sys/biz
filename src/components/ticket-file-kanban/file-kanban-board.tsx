'use client';

import { useEffect, useMemo, useState } from 'react';
import { closestCorners, DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { FileKanbanCardForm } from './file-kanban-card-form';
import { FileKanbanCategoryForm } from './file-kanban-category-form';
import { FileKanbanSection } from './file-kanban-section';
import { useTicketFileKanbanStore } from '@/stores/ticket-file-kanban-store';
import type { TicketFileKanbanCard, TicketFileKanbanCategory } from '@/types/ticket-file-kanban';

function getCategoryIdFromTarget(target: DragEndEvent['over'] | DragOverEvent['over'], cards: TicketFileKanbanCard[]) {
  const data = target?.data.current;
  if (data?.type === 'card') return data.card.category_id as string;
  const targetId = String(target?.id || '');
  const existingCard = cards.find((card) => card.id === targetId);
  return existingCard?.category_id ?? targetId;
}

function getTargetPosition(target: DragEndEvent['over'] | DragOverEvent['over'], cards: TicketFileKanbanCard[], categoryId: string) {
  const targetId = String(target?.id || '');
  const siblingCards = cards.filter((card) => card.category_id === categoryId).sort((a, b) => a.position - b.position);
  const targetIndex = siblingCards.findIndex((card) => card.id === targetId);
  return targetIndex >= 0 ? targetIndex : siblingCards.length;
}

function buildReorderedCards(cards: TicketFileKanbanCard[], activeId: string, targetCategoryId: string, targetPosition: number) {
  const active = cards.find((card) => card.id === activeId);
  if (!active) return cards;

  const sourceCategoryId = active.category_id;
  const affectedCategories = new Set([sourceCategoryId, targetCategoryId]);
  const nextCards = cards.map((card) =>
    card.id === activeId ? { ...card, category_id: targetCategoryId } : card
  );

  const updatedCategories = [...affectedCategories].flatMap((categoryId) => {
    const siblings = nextCards
      .filter((card) => card.category_id === categoryId && card.id !== activeId)
      .sort((a, b) => a.position - b.position);

    if (categoryId === targetCategoryId) {
      const insertionIndex = Math.max(0, Math.min(targetPosition, siblings.length));
      siblings.splice(insertionIndex, 0, { ...active, category_id: targetCategoryId, position: insertionIndex });
    }

    return siblings.map((card, index) => ({ ...card, position: index }));
  });

  const unaffected = nextCards.filter((card) => !affectedCategories.has(card.category_id));
  return [...updatedCategories, ...unaffected];
}

export function FileKanbanBoard({ ticketId, embedded = false }: { ticketId: string; embedded?: boolean }) {
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
    reorderCards,
    autoPopulate,
  } = useTicketFileKanbanStore();
  const [editingCard, setEditingCard] = useState<TicketFileKanbanCard | null>(null);
  const [editingCategory, setEditingCategory] = useState<TicketFileKanbanCategory | null>(null);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [cardCategoryId, setCardCategoryId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetchBoard(ticketId).catch((error) => {
      console.error('Failed to load file kanban board:', error);
    });
  }, [ticketId, fetchBoard]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const cardsByCategory = useMemo(() => {
    const map = new Map<string, TicketFileKanbanCard[]>();
    for (const category of categories) {
      map.set(category.id, cards.filter((card) => card.category_id === category.id).sort((a, b) => a.position - b.position));
    }
    return map;
  }, [categories, cards]);

  const handleDragStart = (event: DragStartEvent) => {
    const active = cards.find((card) => card.id === String(event.active.id));
    if (active) {
      setCardCategoryId(active.category_id);
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
    const nextCards = buildReorderedCards(cards, active.id, targetCategoryId, targetPosition);
    const changed = nextCards.filter((card) => {
      const original = cards.find((item) => item.id === card.id);
      return original && (original.category_id !== card.category_id || original.position !== card.position);
    }).map((card) => ({ id: card.id, category_id: card.category_id, position: card.position }));

    if (changed.length > 0) {
      void reorderCards(ticketId, changed);
    }
  };

  const handleCreateCategory = async (input: { name: string; color: string }) => {
    if (editingCategory) {
      await updateCategory(ticketId, editingCategory.id, input);
      return;
    }
    await createCategory(ticketId, input);
  };

  const handleDeleteCategory = editingCategory && editingCategory.is_default !== 1
    ? async () => deleteCategory(ticketId, editingCategory.id)
    : undefined;

  const handleSaveCard = async (input: { category_id: string; file_name: string; description?: string | null }) => {
    if (editingCard) {
      await updateCard(ticketId, editingCard.id, input);
      return;
    }
    await createCard(ticketId, input);
  };

  const handleAutoPopulate = async () => {
    setSyncing(true);
    try {
      await autoPopulate(ticketId);
    } catch (error) {
      console.error('Failed to auto-populate file kanban:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className={embedded ? '' : 'rounded-lg border border-border bg-card shadow-sm'}>
      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${embedded ? '' : 'border-b border-border'}`}>
        {!embedded && (
          <div>
            <h2 className="text-lg font-medium text-foreground">파일 칸반</h2>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleAutoPopulate}
            disabled={syncing}
            size="xs"
          >
            {syncing ? 'SYNCING...' : 'AUTO-SYNC'}
          </Button>
          <Button
            type="button"
            className="border-[#cdd7e3] bg-[#f7f9fb] text-[#002C5F] hover:border-[#b7c5d6] hover:bg-[#eef3f8]"
            onClick={() => {
              setEditingCategory(null);
              setCategoryFormOpen(true);
            }}
            size="xs"
          >
            + CATEGORY
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[#cdd7e3] bg-[#f7f9fb] text-[#002C5F] hover:border-[#b7c5d6] hover:bg-[#eef3f8]"
            onClick={() => {
              setEditingCard(null);
              setCardCategoryId(categories[0]?.id || '');
              setCardFormOpen(true);
            }}
            size="xs"
          >
            + FILE
          </Button>
        </div>
      </div>

      <div className="p-4">
        {loading && categories.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">파일 칸반을 불러오는 중입니다.</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="min-h-[220px] divide-y divide-border/60">
              {categories.map((category) => (
                <FileKanbanSection
                  key={category.id}
                  category={category}
                  cards={cardsByCategory.get(category.id) || []}
                  collapsed={Boolean(collapsedCategoryIds[category.id])}
                  onToggleCollapsed={() => {
                    setCollapsedCategoryIds((prev) => ({
                      ...prev,
                      [category.id]: !prev[category.id],
                    }));
                  }}
                  onAddCard={(categoryId) => {
                    setCardCategoryId(categoryId);
                    setEditingCard(null);
                    setCardFormOpen(true);
                  }}
                  onEditCard={(card) => {
                    setEditingCard(card);
                    setCardCategoryId(card.category_id);
                    setCardFormOpen(true);
                  }}
                  onEditCategory={(categoryValue) => {
                    setEditingCategory(categoryValue);
                    setCategoryFormOpen(true);
                  }}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>

      <FileKanbanCardForm
        open={cardFormOpen}
        categories={categories}
        categoryId={cardCategoryId}
        card={editingCard}
        onOpenChange={setCardFormOpen}
        onSubmit={handleSaveCard}
        onDelete={editingCard ? async () => deleteCard(ticketId, editingCard.id) : undefined}
      />

      <FileKanbanCategoryForm
        open={categoryFormOpen}
        category={editingCategory}
        onOpenChange={setCategoryFormOpen}
        onSubmit={handleCreateCategory}
        onDelete={handleDeleteCategory}
      />
    </section>
  );
}
