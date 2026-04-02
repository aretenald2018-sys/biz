import { create } from 'zustand';
import type { EmailFlowStep, FlowStepType } from '@/types/email-flow';

interface EmailFlowStore {
  // Map of emailId -> steps
  flowSteps: Record<string, EmailFlowStep[]>;
  loading: Record<string, boolean>;

  fetchFlowSteps: (ticketId: string, emailId: string) => Promise<void>;
  createFlowStep: (ticketId: string, emailId: string, data: { step_type: FlowStepType; actor?: string; summary: string; is_current?: boolean }) => Promise<void>;
  updateFlowStep: (ticketId: string, emailId: string, data: { id: string; step_type?: FlowStepType; actor?: string; summary?: string; is_current?: boolean }) => Promise<void>;
  deleteFlowStep: (ticketId: string, emailId: string, stepId: string) => Promise<void>;
}

export const useEmailFlowStore = create<EmailFlowStore>((set, get) => ({
  flowSteps: {},
  loading: {},

  fetchFlowSteps: async (ticketId, emailId) => {
    set({ loading: { ...get().loading, [emailId]: true } });
    const res = await fetch(`/api/tickets/${ticketId}/emails/${emailId}/flow`);
    if (res.ok) {
      const steps = await res.json();
      set({
        flowSteps: { ...get().flowSteps, [emailId]: steps },
        loading: { ...get().loading, [emailId]: false },
      });
    } else {
      set({ loading: { ...get().loading, [emailId]: false } });
    }
  },

  createFlowStep: async (ticketId, emailId, data) => {
    const res = await fetch(`/api/tickets/${ticketId}/emails/${emailId}/flow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await get().fetchFlowSteps(ticketId, emailId);
    }
  },

  updateFlowStep: async (ticketId, emailId, data) => {
    const res = await fetch(`/api/tickets/${ticketId}/emails/${emailId}/flow`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await get().fetchFlowSteps(ticketId, emailId);
    }
  },

  deleteFlowStep: async (ticketId, emailId, stepId) => {
    await fetch(`/api/tickets/${ticketId}/emails/${emailId}/flow?step_id=${stepId}`, {
      method: 'DELETE',
    });
    await get().fetchFlowSteps(ticketId, emailId);
  },
}));
