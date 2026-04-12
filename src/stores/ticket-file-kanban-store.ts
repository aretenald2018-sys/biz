import { create } from 'zustand';
import type {
  CreateTicketFileKanbanCardInput,
  CreateTicketFileKanbanCategoryInput,
  ReorderTicketFileKanbanCardInput,
  TicketFileKanbanCard,
  TicketFileKanbanCategory,
  UpdateTicketFileKanbanCardInput,
  UpdateTicketFileKanbanCategoryInput,
} from '@/types/ticket-file-kanban';

function sortCategories(categories: TicketFileKanbanCategory[]) {
  return [...categories].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

function sortCards(cards: TicketFileKanbanCard[]) {
  return [...cards].sort((a, b) => {
    if (a.category_id !== b.category_id) return a.category_id.localeCompare(b.category_id);
    return a.position - b.position || a.created_at.localeCompare(b.created_at);
  });
}

async function readResponseError(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  return `${fallbackMessage} (${response.status})`;
}

interface TicketFileKanbanStore {
  categories: TicketFileKanbanCategory[];
  cards: TicketFileKanbanCard[];
  loading: boolean;
  fetchBoard: (ticketId: string) => Promise<void>;
  createCategory: (ticketId: string, input: CreateTicketFileKanbanCategoryInput) => Promise<void>;
  updateCategory: (ticketId: string, id: string, input: UpdateTicketFileKanbanCategoryInput) => Promise<void>;
  deleteCategory: (ticketId: string, id: string) => Promise<void>;
  createCard: (ticketId: string, input: CreateTicketFileKanbanCardInput) => Promise<void>;
  updateCard: (ticketId: string, id: string, input: UpdateTicketFileKanbanCardInput) => Promise<void>;
  deleteCard: (ticketId: string, id: string) => Promise<void>;
  reorderCards: (ticketId: string, cards: ReorderTicketFileKanbanCardInput[]) => Promise<void>;
  autoPopulate: (ticketId: string) => Promise<void>;
}

export const useTicketFileKanbanStore = create<TicketFileKanbanStore>((set, get) => ({
  categories: [],
  cards: [],
  loading: false,

  fetchBoard: async (ticketId) => {
    set({ loading: true });
    try {
      const [categoriesRes, cardsRes] = await Promise.all([
        fetch(`/api/tickets/${ticketId}/file-kanban/categories`),
        fetch(`/api/tickets/${ticketId}/file-kanban/cards`),
      ]);

      if (!categoriesRes.ok) {
        throw new Error(await readResponseError(categoriesRes, 'Failed to load file kanban categories'));
      }
      if (!cardsRes.ok) {
        throw new Error(await readResponseError(cardsRes, 'Failed to load file kanban cards'));
      }

      const [categories, cards] = await Promise.all([categoriesRes.json(), cardsRes.json()]);
      set({ categories: sortCategories(categories), cards: sortCards(cards) });
    } finally {
      set({ loading: false });
    }
  },

  createCategory: async (ticketId, input) => {
    const res = await fetch(`/api/tickets/${ticketId}/file-kanban/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to create category'));
    }
    await get().fetchBoard(ticketId);
  },

  updateCategory: async (ticketId, id, input) => {
    const res = await fetch(`/api/tickets/${ticketId}/file-kanban/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to update category'));
    }
    await get().fetchBoard(ticketId);
  },

  deleteCategory: async (ticketId, id) => {
    const res = await fetch(`/api/tickets/${ticketId}/file-kanban/categories/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to delete category'));
    }
    await get().fetchBoard(ticketId);
  },

  createCard: async (ticketId, input) => {
    const res = await fetch(`/api/tickets/${ticketId}/file-kanban/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to create card'));
    }
    await get().fetchBoard(ticketId);
  },

  updateCard: async (ticketId, id, input) => {
    const res = await fetch(`/api/tickets/${ticketId}/file-kanban/cards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to update card'));
    }
    await get().fetchBoard(ticketId);
  },

  deleteCard: async (ticketId, id) => {
    const res = await fetch(`/api/tickets/${ticketId}/file-kanban/cards/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to delete card'));
    }
    await get().fetchBoard(ticketId);
  },

  reorderCards: async (ticketId, cards) => {
    const previousCards = get().cards;
    set({
      cards: sortCards(cards.length > 0
        ? previousCards.map((card) => {
            const next = cards.find((item) => item.id === card.id);
            return next ? { ...card, category_id: next.category_id, position: next.position } : card;
          })
        : previousCards),
    });

    try {
      const res = await fetch(`/api/tickets/${ticketId}/file-kanban/cards/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards }),
      });
      if (!res.ok) {
        throw new Error(await readResponseError(res, 'Failed to reorder cards'));
      }
      await get().fetchBoard(ticketId);
    } catch (error) {
      set({ cards: previousCards });
      throw error;
    }
  },

  autoPopulate: async (ticketId) => {
    const res = await fetch(`/api/tickets/${ticketId}/file-kanban/auto-populate`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to auto-populate'));
    }
    await get().fetchBoard(ticketId);
  },
}));
