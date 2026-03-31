import { create } from 'zustand';
import type { Ticket, CreateTicketInput, UpdateTicketInput, TicketStatus } from '@/types/ticket';

interface TicketStore {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  loading: boolean;
  filter: TicketStatus | null;

  fetchTickets: () => Promise<void>;
  fetchTicket: (id: string) => Promise<void>;
  createTicket: (input: CreateTicketInput) => Promise<Ticket>;
  updateTicket: (id: string, input: UpdateTicketInput) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  setFilter: (status: TicketStatus | null) => void;
}

export const useTicketStore = create<TicketStore>((set, get) => ({
  tickets: [],
  selectedTicket: null,
  loading: false,
  filter: null,

  fetchTickets: async () => {
    set({ loading: true });
    const filter = get().filter;
    const url = filter ? `/api/tickets?status=${encodeURIComponent(filter)}` : '/api/tickets';
    const res = await fetch(url);
    const tickets = await res.json();
    set({ tickets, loading: false });
  },

  fetchTicket: async (id: string) => {
    const res = await fetch(`/api/tickets/${id}`);
    if (res.ok) {
      const ticket = await res.json();
      set({ selectedTicket: ticket });
    }
  },

  createTicket: async (input: CreateTicketInput) => {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const ticket = await res.json();
    await get().fetchTickets();
    return ticket;
  },

  updateTicket: async (id: string, input: UpdateTicketInput) => {
    await fetch(`/api/tickets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await get().fetchTickets();
    if (get().selectedTicket?.id === id) {
      await get().fetchTicket(id);
    }
  },

  deleteTicket: async (id: string) => {
    await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
    set({ selectedTicket: null });
    await get().fetchTickets();
  },

  setFilter: (status: TicketStatus | null) => {
    set({ filter: status });
    get().fetchTickets();
  },
}));
