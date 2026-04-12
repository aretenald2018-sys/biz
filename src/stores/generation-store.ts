import { create } from 'zustand';
import type { GenerationBestPractice, GenerationTemplate, GenerationType } from '@/types/generation';

async function readError(res: Response, fallback: string) {
  const payload = await res.json().catch(() => null);
  if (payload && typeof payload.error === 'string') return payload.error;
  return fallback;
}

interface GenerationStore {
  templates: Record<GenerationType, GenerationTemplate[]>;
  bestPractices: Record<GenerationType, GenerationBestPractice[]>;
  generating: boolean;
  loading: boolean;
  fetchAll: (type: GenerationType) => Promise<void>;
  createTemplate: (input: { type: GenerationType; name: string; content: string; is_default?: number }) => Promise<void>;
  updateTemplate: (id: string, input: { name?: string; content?: string; is_default?: number }, type: GenerationType) => Promise<void>;
  deleteTemplate: (id: string, type: GenerationType) => Promise<void>;
  createBestPractice: (input: { type: GenerationType; title: string; content: string }) => Promise<void>;
  updateBestPractice: (id: string, input: { title?: string; content?: string }, type: GenerationType) => Promise<void>;
  deleteBestPractice: (id: string, type: GenerationType) => Promise<void>;
  generateWeeklyReport: (ticketId: string, templateId?: string, rangeDays?: number) => Promise<string>;
  generateDoorayReport: (ticketId: string, templateId?: string, rangeDays?: number) => Promise<string>;
}

export const useGenerationStore = create<GenerationStore>((set, get) => ({
  templates: { weekly_report: [], dooray: [] },
  bestPractices: { weekly_report: [], dooray: [] },
  generating: false,
  loading: false,

  fetchAll: async (type) => {
    set({ loading: true });
    try {
      const [templateRes, practiceRes] = await Promise.all([
        fetch(`/api/generation/templates?type=${type}`),
        fetch(`/api/generation/best-practices?type=${type}`),
      ]);
      if (!templateRes.ok) throw new Error(await readError(templateRes, 'Failed to load templates'));
      if (!practiceRes.ok) throw new Error(await readError(practiceRes, 'Failed to load best practices'));
      const [templates, bestPractices] = await Promise.all([templateRes.json(), practiceRes.json()]);
      set((state) => ({
        templates: { ...state.templates, [type]: templates },
        bestPractices: { ...state.bestPractices, [type]: bestPractices },
      }));
    } finally {
      set({ loading: false });
    }
  },

  createTemplate: async (input) => {
    const res = await fetch('/api/generation/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to create template'));
    await get().fetchAll(input.type);
  },

  updateTemplate: async (id, input, type) => {
    const res = await fetch(`/api/generation/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to update template'));
    await get().fetchAll(type);
  },

  deleteTemplate: async (id, type) => {
    const res = await fetch(`/api/generation/templates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await readError(res, 'Failed to delete template'));
    await get().fetchAll(type);
  },

  createBestPractice: async (input) => {
    const res = await fetch('/api/generation/best-practices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to create best practice'));
    await get().fetchAll(input.type);
  },

  updateBestPractice: async (id, input, type) => {
    const res = await fetch(`/api/generation/best-practices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readError(res, 'Failed to update best practice'));
    await get().fetchAll(type);
  },

  deleteBestPractice: async (id, type) => {
    const res = await fetch(`/api/generation/best-practices/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await readError(res, 'Failed to delete best practice'));
    await get().fetchAll(type);
  },

  generateWeeklyReport: async (ticketId, templateId, rangeDays = 7) => {
    set({ generating: true });
    try {
      const res = await fetch('/api/generation/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, templateId, rangeDays }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to generate weekly report'));
      const payload = await res.json();
      return String(payload.markdown || '');
    } finally {
      set({ generating: false });
    }
  },

  generateDoorayReport: async (ticketId, templateId, rangeDays = 14) => {
    set({ generating: true });
    try {
      const res = await fetch('/api/generation/dooray', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, templateId, rangeDays }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to generate dooray report'));
      const payload = await res.json();
      return String(payload.markdown || '');
    } finally {
      set({ generating: false });
    }
  },
}));

