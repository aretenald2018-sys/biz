import { create } from 'zustand';
import type { CreateKanbanCategoryInput, KanbanBoardView, KanbanCategory, UpdateKanbanCategoryInput } from '@/types/kanban';
import type { CreateTicketInput, Ticket, UpdateTicketInput } from '@/types/ticket';

function sortCategories(categories: KanbanCategory[]) {
  return [...categories].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

function sortTickets(tickets: Ticket[]) {
  return [...tickets].sort((a, b) => {
    const leftCategory = a.category_id || '';
    const rightCategory = b.category_id || '';

    if (leftCategory !== rightCategory) {
      return leftCategory.localeCompare(rightCategory);
    }

    return a.position - b.position || a.created_at.localeCompare(b.created_at);
  });
}

function flattenBoard(board: KanbanBoardView) {
  const categories = board.categories.map(({ tickets: _tickets, ...category }) => category);
  const tickets = board.categories.flatMap((category) => category.tickets);
  return {
    categories: sortCategories(categories),
    tickets: sortTickets(tickets),
  };
}

async function readResponseError(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  return `${fallbackMessage} (${response.status})`;
}

interface KanbanStore {
  categories: KanbanCategory[];
  tickets: Ticket[];
  loading: boolean;
  fetchBoard: () => Promise<void>;
  createCategory: (input: CreateKanbanCategoryInput) => Promise<void>;
  updateCategory: (id: string, input: UpdateKanbanCategoryInput) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createCard: (input: CreateTicketInput) => Promise<void>;
  updateCard: (id: string, input: UpdateTicketInput) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (ticketId: string, toCategoryId: string, newPosition: number) => Promise<void>;
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  categories: [],
  tickets: [],
  loading: false,

  fetchBoard: async () => {
    set({ loading: true });
    const boardRes = await fetch('/api/kanban/board');
    const board = await boardRes.json() as KanbanBoardView;
    set({ ...flattenBoard(board), loading: false });
  },

  createCategory: async (input) => {
    const res = await fetch('/api/kanban/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to create category'));
    }
    await get().fetchBoard();
  },

  updateCategory: async (id, input) => {
    const res = await fetch(`/api/kanban/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to update category'));
    }
    await get().fetchBoard();
  },

  deleteCategory: async (id) => {
    const res = await fetch(`/api/kanban/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to delete category'));
    }
    await get().fetchBoard();
  },

  createCard: async (input) => {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to create ticket'));
    }
    await get().fetchBoard();
  },

  updateCard: async (id, input) => {
    const res = await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to update ticket'));
    }
    await get().fetchBoard();
  },

  deleteCard: async (id) => {
    const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(await readResponseError(res, 'Failed to delete ticket'));
    }
    await get().fetchBoard();
  },

  moveCard: async (ticketId, toCategoryId, newPosition) => {
    const previousTickets = get().tickets;
    const movedTicket = previousTickets.find((ticket) => ticket.id === ticketId);
    if (!movedTicket || !movedTicket.category_id) return;

    const sourceCategoryId = movedTicket.category_id;
    const nextTickets = previousTickets.map((ticket) =>
      ticket.id === ticketId ? { ...ticket, category_id: toCategoryId } : ticket
    );

    const sourceTickets = nextTickets
      .filter((ticket) => ticket.category_id === sourceCategoryId && ticket.id !== ticketId)
      .sort((a, b) => a.position - b.position);

    const targetTickets = nextTickets
      .filter((ticket) => ticket.category_id === toCategoryId && ticket.id !== ticketId)
      .sort((a, b) => a.position - b.position);

    const insertionIndex = Math.max(0, Math.min(newPosition, targetTickets.length));
    targetTickets.splice(insertionIndex, 0, { ...movedTicket, category_id: toCategoryId, position: insertionIndex });

    const reordered = [
      ...sourceTickets.map((ticket, index) => ({ ...ticket, position: index })),
      ...targetTickets.map((ticket, index) => ({ ...ticket, position: index })),
      ...nextTickets.filter((ticket) => ticket.category_id !== sourceCategoryId && ticket.category_id !== toCategoryId),
    ];

    set({ tickets: sortTickets(reordered) });

    try {
      const res = await fetch('/api/kanban/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickets: reordered
            .filter((ticket) => ticket.category_id === sourceCategoryId || ticket.category_id === toCategoryId)
            .map((ticket) => ({
              ticketId: ticket.id,
              category_id: ticket.category_id,
              position: ticket.position,
            })),
        }),
      });
      if (!res.ok) {
        throw new Error(await readResponseError(res, 'Failed to reorder tickets'));
      }
      await get().fetchBoard();
    } catch (error) {
      set({ tickets: previousTickets });
      throw error;
    }
  },
}));
