import { create } from 'zustand';
import type { TermsBoardResponse, TermsFactType, TermsReviewQueueResponse } from '@/types/terms';

interface TermsFactStore {
  review: TermsReviewQueueResponse | null;
  board: TermsBoardResponse | null;
  error: string | null;
  loading: boolean;
  actionLoading: boolean;
  marketEntityFilter: string | null;
  fetchReview: (marketEntity?: string | null) => Promise<void>;
  fetchBoard: (marketEntity?: string | null) => Promise<void>;
  extractFacts: (versionId: number) => Promise<void>;
  approveFact: (type: TermsFactType, id: number, reviewer?: string | null) => Promise<void>;
  rejectFact: (type: TermsFactType, id: number, reviewer?: string | null) => Promise<void>;
  clearError: () => void;
}

async function ensureOk(response: Response, fallback: string) {
  if (response.ok) {
    return response;
  }

  const payload = await response.json().catch(() => null);
  throw new Error(payload?.error || fallback);
}

function toQueryString(marketEntity?: string | null) {
  return marketEntity ? `?market_entity=${encodeURIComponent(marketEntity)}` : '';
}

export const useTermsFactStore = create<TermsFactStore>((set, get) => ({
  review: null,
  board: null,
  error: null,
  loading: false,
  actionLoading: false,
  marketEntityFilter: null,

  fetchReview: async (marketEntity) => {
    set({ loading: true, error: null, marketEntityFilter: marketEntity ?? null });

    try {
      const response = await ensureOk(await fetch(`/api/terms/facts/review${toQueryString(marketEntity)}`), '검토 큐를 불러오지 못했습니다.');
      const review = await response.json() as TermsReviewQueueResponse;
      set({ review, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '검토 큐를 불러오지 못했습니다.',
        loading: false,
      });
      throw error;
    }
  },

  fetchBoard: async (marketEntity) => {
    set({ loading: true, error: null, marketEntityFilter: marketEntity ?? null });

    try {
      const response = await ensureOk(await fetch(`/api/terms/facts/board${toQueryString(marketEntity)}`), '보드를 불러오지 못했습니다.');
      const board = await response.json() as TermsBoardResponse;
      set({ board, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '보드를 불러오지 못했습니다.',
        loading: false,
      });
      throw error;
    }
  },

  extractFacts: async (versionId) => {
    set({ actionLoading: true, error: null });

    try {
      await ensureOk(
        await fetch(`/api/terms/facts/extract/${versionId}`, {
          method: 'POST',
        }),
        'fact 추출에 실패했습니다.',
      );
      const filter = get().marketEntityFilter;
      await Promise.all([get().fetchReview(filter), get().fetchBoard(filter)]);
      set({ actionLoading: false });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : 'fact 추출에 실패했습니다.',
      });
      throw error;
    }
  },

  approveFact: async (type, id, reviewer) => {
    set({ actionLoading: true, error: null });

    try {
      await ensureOk(
        await fetch(`/api/terms/facts/${type}/${id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewer }),
        }),
        'fact 승인에 실패했습니다.',
      );
      const filter = get().marketEntityFilter;
      await Promise.all([get().fetchReview(filter), get().fetchBoard(filter)]);
      set({ actionLoading: false });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : 'fact 승인에 실패했습니다.',
      });
      throw error;
    }
  },

  rejectFact: async (type, id, reviewer) => {
    set({ actionLoading: true, error: null });

    try {
      await ensureOk(
        await fetch(`/api/terms/facts/${type}/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewer }),
        }),
        'fact 반려에 실패했습니다.',
      );
      const filter = get().marketEntityFilter;
      await Promise.all([get().fetchReview(filter), get().fetchBoard(filter)]);
      set({ actionLoading: false });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : 'fact 반려에 실패했습니다.',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
