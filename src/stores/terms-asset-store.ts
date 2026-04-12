import { create } from 'zustand';
import type {
  GapReportEntry,
  TermsAsset,
  TermsAssetInput,
  TermsAssetPatchInput,
  TermsAssetCandidate,
  TermsController,
  TermsDocumentDiff,
  TermsDocumentVersion,
  TermsInboxSummary,
  TermsMarketEntity,
} from '@/types/terms';

interface TermsVersionPayload {
  asset: TermsAsset;
  versions: TermsDocumentVersion[];
}

interface TermsAssetStore {
  marketEntities: TermsMarketEntity[];
  controllers: TermsController[];
  assets: TermsAsset[];
  candidates: TermsAssetCandidate[];
  gaps: GapReportEntry[];
  inbox: TermsInboxSummary | null;
  activeAsset: TermsAsset | null;
  activeVersions: TermsDocumentVersion[];
  versionDiffs: Record<number, TermsDocumentDiff | null>;
  error: string | null;
  loading: boolean;
  detailLoading: boolean;
  actionLoading: boolean;
  fetchReferenceData: () => Promise<void>;
  fetchAssets: (filters?: Record<string, string | null | undefined>) => Promise<void>;
  saveAsset: (input: TermsAssetInput | TermsAssetPatchInput, id?: number | null) => Promise<TermsAsset | null>;
  deleteAsset: (id: number) => Promise<void>;
  fetchCandidates: (status?: string | null) => Promise<void>;
  promoteCandidate: (id: number, input?: { reviewer?: string; asset?: Partial<TermsAssetInput> }) => Promise<void>;
  rejectCandidate: (id: number, reason?: string, reviewer?: string) => Promise<void>;
  discoverCandidates: (assetId?: number | null) => Promise<void>;
  fetchVersions: (assetId: number) => Promise<void>;
  fetchVersionDiff: (versionId: number) => Promise<TermsDocumentDiff | null>;
  captureAsset: (assetId: number, force?: boolean) => Promise<void>;
  uploadVersion: (assetId: number, file: File, uploadedBy?: string) => Promise<void>;
  fetchGaps: (marketEntity?: string | null) => Promise<void>;
  fetchInbox: (marketEntity?: string | null) => Promise<void>;
  clearError: () => void;
}

async function ensureOk(response: Response, fallback: string) {
  if (response.ok) {
    return response;
  }

  const payload = await response.json().catch(() => null);
  throw new Error(payload?.error || fallback);
}

function toQueryString(filters?: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const useTermsAssetStore = create<TermsAssetStore>((set, get) => ({
  marketEntities: [],
  controllers: [],
  assets: [],
  candidates: [],
  gaps: [],
  inbox: null,
  activeAsset: null,
  activeVersions: [],
  versionDiffs: {},
  error: null,
  loading: false,
  detailLoading: false,
  actionLoading: false,

  fetchReferenceData: async () => {
    set({ loading: true, error: null });

    try {
      const [marketEntitiesResponse, controllersResponse] = await Promise.all([
        ensureOk(await fetch('/api/terms/market-entities'), '법인 마스터를 불러오지 못했습니다.'),
        ensureOk(await fetch('/api/terms/controllers'), '컨트롤러 마스터를 불러오지 못했습니다.'),
      ]);

      const [marketEntities, controllers] = await Promise.all([
        marketEntitiesResponse.json() as Promise<TermsMarketEntity[]>,
        controllersResponse.json() as Promise<TermsController[]>,
      ]);

      set({ marketEntities, controllers, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '참조 데이터를 불러오지 못했습니다.',
        loading: false,
      });
      throw error;
    }
  },

  fetchAssets: async (filters) => {
    set({ loading: true, error: null });

    try {
      const response = await ensureOk(await fetch(`/api/terms/assets${toQueryString(filters)}`), 'asset 목록을 불러오지 못했습니다.');
      const assets = await response.json() as TermsAsset[];
      set({ assets, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'asset 목록을 불러오지 못했습니다.',
        loading: false,
      });
      throw error;
    }
  },

  saveAsset: async (input, id) => {
    set({ actionLoading: true, error: null });

    try {
      const response = await ensureOk(
        await fetch(id ? `/api/terms/assets/${id}` : '/api/terms/assets', {
          method: id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
        'asset을 저장하지 못했습니다.',
      );
      const asset = await response.json() as TermsAsset;
      await get().fetchAssets();
      set({ actionLoading: false });
      return asset;
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : 'asset을 저장하지 못했습니다.',
      });
      throw error;
    }
  },

  deleteAsset: async (id) => {
    set({ actionLoading: true, error: null });

    try {
      await ensureOk(await fetch(`/api/terms/assets/${id}`, { method: 'DELETE' }), 'asset을 삭제하지 못했습니다.');
      await get().fetchAssets();
      set((state) => ({
        actionLoading: false,
        activeAsset: state.activeAsset?.id === id ? null : state.activeAsset,
        activeVersions: state.activeAsset?.id === id ? [] : state.activeVersions,
      }));
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : 'asset을 삭제하지 못했습니다.',
      });
      throw error;
    }
  },

  fetchCandidates: async (status) => {
    set({ loading: true, error: null });

    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const response = await ensureOk(await fetch(`/api/terms/candidates${query}`), 'candidate 목록을 불러오지 못했습니다.');
      const candidates = await response.json() as TermsAssetCandidate[];
      set({ candidates, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'candidate 목록을 불러오지 못했습니다.',
        loading: false,
      });
      throw error;
    }
  },

  promoteCandidate: async (id, input) => {
    set({ actionLoading: true, error: null });

    try {
      await ensureOk(
        await fetch(`/api/terms/candidates/${id}/promote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input ?? {}),
        }),
        'candidate를 승격하지 못했습니다.',
      );
      await Promise.all([get().fetchCandidates(), get().fetchAssets()]);
      set({ actionLoading: false });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : 'candidate를 승격하지 못했습니다.',
      });
      throw error;
    }
  },

  rejectCandidate: async (id, reason, reviewer) => {
    set({ actionLoading: true, error: null });

    try {
      await ensureOk(
        await fetch(`/api/terms/candidates/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, reviewer }),
        }),
        'candidate를 반려하지 못했습니다.',
      );
      await get().fetchCandidates();
      set({ actionLoading: false });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : 'candidate를 반려하지 못했습니다.',
      });
      throw error;
    }
  },

  discoverCandidates: async (assetId) => {
    set({ actionLoading: true, error: null });

    try {
      await ensureOk(
        await fetch('/api/terms/assets/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assetId ? { asset_id: assetId } : {}),
        }),
        'candidate discovery를 실행하지 못했습니다.',
      );
      await get().fetchCandidates();
      set({ actionLoading: false });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : 'candidate discovery를 실행하지 못했습니다.',
      });
      throw error;
    }
  },

  fetchVersions: async (assetId) => {
    set({ detailLoading: true, error: null });

    try {
      const response = await ensureOk(await fetch(`/api/terms/documents/${assetId}/versions`), '버전 목록을 불러오지 못했습니다.');
      const payload = await response.json() as TermsVersionPayload;
      set({
        activeAsset: payload.asset,
        activeVersions: payload.versions,
        detailLoading: false,
      });
    } catch (error) {
      set({
        detailLoading: false,
        error: error instanceof Error ? error.message : '버전 목록을 불러오지 못했습니다.',
      });
      throw error;
    }
  },

  fetchVersionDiff: async (versionId) => {
    try {
      const response = await ensureOk(await fetch(`/api/terms/documents/diff/${versionId}`), 'diff를 불러오지 못했습니다.');
      const diff = await response.json() as TermsDocumentDiff | null;
      set((state) => ({
        versionDiffs: {
          ...state.versionDiffs,
          [versionId]: diff,
        },
      }));
      return diff;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'diff를 불러오지 못했습니다.',
      });
      throw error;
    }
  },

  captureAsset: async (assetId, force = false) => {
    set({ actionLoading: true, error: null });

    try {
      await ensureOk(
        await fetch(`/api/terms/documents/capture/${assetId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force }),
        }),
        '문서 캡처를 실행하지 못했습니다.',
      );
      await Promise.all([get().fetchAssets(), get().fetchVersions(assetId)]);
      set({ actionLoading: false });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : '문서 캡처를 실행하지 못했습니다.',
      });
      throw error;
    }
  },

  uploadVersion: async (assetId, file, uploadedBy) => {
    set({ actionLoading: true, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (uploadedBy) {
        formData.append('uploaded_by', uploadedBy);
      }
      await ensureOk(
        await fetch(`/api/terms/documents/upload/${assetId}`, {
          method: 'POST',
          body: formData,
        }),
        '문서 업로드에 실패했습니다.',
      );
      await get().fetchVersions(assetId);
      set({ actionLoading: false });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : '문서 업로드에 실패했습니다.',
      });
      throw error;
    }
  },

  fetchGaps: async (marketEntity) => {
    set({ loading: true, error: null });

    try {
      const query = marketEntity ? `?market_entity=${encodeURIComponent(marketEntity)}` : '';
      const response = await ensureOk(await fetch(`/api/terms/gaps${query}`), 'gap 리포트를 불러오지 못했습니다.');
      const gaps = await response.json() as GapReportEntry[];
      set({ gaps, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'gap 리포트를 불러오지 못했습니다.',
      });
      throw error;
    }
  },

  fetchInbox: async (marketEntity) => {
    set({ loading: true, error: null });

    try {
      const query = marketEntity ? `?market_entity=${encodeURIComponent(marketEntity)}` : '';
      const response = await ensureOk(await fetch(`/api/terms/inbox${query}`), 'inbox를 불러오지 못했습니다.');
      const inbox = await response.json() as TermsInboxSummary;
      set({ inbox, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'inbox를 불러오지 못했습니다.',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
