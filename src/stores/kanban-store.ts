import { create } from 'zustand';
import type {
  CreateKanbanCardInput,
  CreateKanbanCategoryInput,
  KanbanCard,
  KanbanCategory,
  UpdateKanbanCardInput,
  UpdateKanbanCategoryInput,
} from '@/types/kanban';

function sortCategories(categories: KanbanCategory[]) {
  return [...categories].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

function sortCards(cards: KanbanCard[]) {
  return [...cards].sort((a, b) => {
    if (a.category_id !== b.category_id) {
      return a.category_id.localeCompare(b.category_id);
    }
    return a.position - b.position || a.created_at.localeCompare(b.created_at);
  });
}

interface KanbanStore {
  categories: KanbanCategory[];
  cards: KanbanCard[];
  loading: boolean;
  fetchBoard: () => Promise<void>;
  createCategory: (input: CreateKanbanCategoryInput) => Promise<void>;
  updateCategory: (id: string, input: UpdateKanbanCategoryInput) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createCard: (input: CreateKanbanCardInput) => Promise<void>;
  updateCard: (id: string, input: UpdateKanbanCardInput) => Promise<void>;
  deleteCard: (id: string, ticketId?: string | null) => Promise<void>;
  moveCard: (cardId: string, toCategoryId: string, newPosition: number) => Promise<void>;
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  categories: [],
  cards: [],
  loading: false,

  fetchBoard: async () => {
    set({ loading: true });
    const [categoriesRes, cardsRes] = await Promise.all([
      fetch('/api/kanban/categories'),
      fetch('/api/kanban/cards'),
    ]);
    const [categories, cards] = await Promise.all([categoriesRes.json(), cardsRes.json()]);
    set({ categories: sortCategories(categories), cards: sortCards(cards), loading: false });
  },

  createCategory: async (input) => {
    await fetch('/api/kanban/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await get().fetchBoard();
  },

  updateCategory: async (id, input) => {
    await fetch(`/api/kanban/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await get().fetchBoard();
  },

  deleteCategory: async (id) => {
    await fetch(`/api/kanban/categories/${id}`, { method: 'DELETE' });
    await get().fetchBoard();
  },

  createCard: async (input) => {
    await fetch('/api/kanban/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await get().fetchBoard();
  },

  updateCard: async (id, input) => {
    await fetch(`/api/kanban/cards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await get().fetchBoard();
  },

  deleteCard: async (id, ticketId) => {
    await fetch(`/api/kanban/cards/${id}`, { method: 'DELETE' });
    if (ticketId) {
      await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
    }
    await get().fetchBoard();
  },

  moveCard: async (cardId, toCategoryId, newPosition) => {
    const previousCards = get().cards;
    const movedCard = previousCards.find((card) => card.id === cardId);
    if (!movedCard) return;

    const sourceCategoryId = movedCard.category_id;
    const nextCards = previousCards.map((card) =>
      card.id === cardId ? { ...card, category_id: toCategoryId } : card
    );

    const sourceCards = nextCards
      .filter((card) => card.category_id === sourceCategoryId && card.id !== cardId)
      .sort((a, b) => a.position - b.position);

    const targetCards = nextCards
      .filter((card) => card.category_id === toCategoryId && card.id !== cardId)
      .sort((a, b) => a.position - b.position);

    const insertionIndex = Math.max(0, Math.min(newPosition, targetCards.length));
    targetCards.splice(insertionIndex, 0, { ...movedCard, category_id: toCategoryId, position: insertionIndex });

    const reordered = [
      ...sourceCards.map((card, index) => ({ ...card, position: index })),
      ...targetCards.map((card, index) => ({ ...card, position: index })),
      ...nextCards.filter((card) => card.category_id !== sourceCategoryId && card.category_id !== toCategoryId),
    ];

    set({ cards: sortCards(reordered) });

    try {
      await fetch('/api/kanban/cards/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: reordered
            .filter((card) => card.category_id === sourceCategoryId || card.category_id === toCategoryId)
            .map((card) => ({ id: card.id, category_id: card.category_id, position: card.position })),
        }),
      });
      await get().fetchBoard();
    } catch (error) {
      set({ cards: previousCards });
      throw error;
    }
  },
}));
