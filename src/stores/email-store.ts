import { create } from 'zustand';
import type { Email } from '@/types/email';

interface EmailStore {
  emails: Email[];
  selectedEmail: Email | null;
  loading: boolean;

  fetchEmails: (ticketId: string) => Promise<void>;
  selectEmail: (email: Email | null) => void;
  uploadEmail: (ticketId: string, file: File) => Promise<void>;
  setParentNote: (ticketId: string, emailId: string, noteId: string | null) => Promise<void>;
  setParentEmail: (ticketId: string, emailId: string, parentEmailId: string | null) => Promise<void>;
  deleteEmail: (ticketId: string, emailId: string) => Promise<void>;
}

export const useEmailStore = create<EmailStore>((set, get) => ({
  emails: [],
  selectedEmail: null,
  loading: false,

  fetchEmails: async (ticketId: string) => {
    set({ loading: true });
    const res = await fetch(`/api/tickets/${ticketId}/emails`);
    if (res.ok) {
      const emails = await res.json();
      set({ emails, loading: false });
    } else {
      set({ loading: false });
    }
  },

  selectEmail: (email: Email | null) => {
    set({ selectedEmail: email });
  },

  uploadEmail: async (ticketId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    await fetch(`/api/tickets/${ticketId}/emails`, {
      method: 'POST',
      body: formData,
    });

    await get().fetchEmails(ticketId);
  },

  setParentNote: async (ticketId: string, emailId: string, noteId: string | null) => {
    await fetch(`/api/tickets/${ticketId}/emails/${emailId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_note_id: noteId }),
    });
    await get().fetchEmails(ticketId);
  },

  setParentEmail: async (ticketId: string, emailId: string, parentEmailId: string | null) => {
    await fetch(`/api/tickets/${ticketId}/emails/${emailId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_email_id: parentEmailId }),
    });
    await get().fetchEmails(ticketId);
  },

  deleteEmail: async (ticketId: string, emailId: string) => {
    await fetch(`/api/tickets/${ticketId}/emails/${emailId}`, {
      method: 'DELETE',
    });
    if (get().selectedEmail?.id === emailId) {
      set({ selectedEmail: null });
    }
    await get().fetchEmails(ticketId);
  },
}));
