import { create } from 'zustand';
import type { Note } from '@/types/note';

interface NoteStore {
  notes: Note[];
  activeNote: string | null;
  loading: boolean;

  fetchNotes: (ticketId: string) => Promise<void>;
  createNote: (ticketId: string, title?: string) => Promise<Note | null>;
  updateNote: (ticketId: string, noteId: string, data: { title?: string; content?: string; parent_email_id?: string | null }) => Promise<void>;
  setParentEmail: (ticketId: string, noteId: string, emailId: string | null) => Promise<void>;
  setParentNote: (ticketId: string, noteId: string, parentNoteId: string | null) => Promise<void>;
  deleteNote: (ticketId: string, noteId: string) => Promise<void>;
  setActiveNote: (id: string | null) => void;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  activeNote: null,
  loading: false,

  fetchNotes: async (ticketId: string) => {
    set({ loading: true });
    const res = await fetch(`/api/tickets/${ticketId}/notes`);
    if (res.ok) {
      const notes = await res.json();
      set({ notes, loading: false });
    } else {
      set({ loading: false });
    }
  },

  createNote: async (ticketId: string, title?: string) => {
    const res = await fetch(`/api/tickets/${ticketId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || 'Untitled', content: '' }),
    });
    if (res.ok) {
      const note = await res.json();
      await get().fetchNotes(ticketId);
      set({ activeNote: note.id });
      return note;
    }
    return null;
  },

  updateNote: async (ticketId: string, noteId: string, data) => {
    await fetch(`/api/tickets/${ticketId}/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    // Update locally without refetching
    set({
      notes: get().notes.map(n =>
        n.id === noteId ? { ...n, ...data, updated_at: new Date().toISOString() } : n
      ),
    });
  },

  setParentEmail: async (ticketId: string, noteId: string, emailId: string | null) => {
    await fetch(`/api/tickets/${ticketId}/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_email_id: emailId }),
    });
    await get().fetchNotes(ticketId);
  },

  setParentNote: async (ticketId: string, noteId: string, parentNoteId: string | null) => {
    await fetch(`/api/tickets/${ticketId}/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_note_id: parentNoteId }),
    });
    await get().fetchNotes(ticketId);
  },

  deleteNote: async (ticketId: string, noteId: string) => {
    await fetch(`/api/tickets/${ticketId}/notes/${noteId}`, { method: 'DELETE' });
    await get().fetchNotes(ticketId);
    if (get().activeNote === noteId) set({ activeNote: null });
  },

  setActiveNote: (id) => set({ activeNote: id }),
}));
