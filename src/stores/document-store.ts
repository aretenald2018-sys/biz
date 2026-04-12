import { create } from 'zustand';
import type {
  DocxAnchorStatus,
  DocxConvertInput,
  DocxDiffResult,
  DocxDiffUpload,
  DocxTemplateDetail,
  DocxTemplateSummary,
  DocxTemplateUpdateInput,
} from '@/types/document';

type DiffSide = 'left' | 'right';

interface DocumentStore {
  templates: DocxTemplateSummary[];
  activeTemplate: DocxTemplateDetail | null;
  diffUploads: Record<DiffSide, DocxDiffUpload | null>;
  diffResult: DocxDiffResult | null;
  error: string | null;
  listLoading: boolean;
  detailLoading: boolean;
  uploadLoading: boolean;
  saveLoading: boolean;
  convertLoading: boolean;
  diffLoading: boolean;
  fetchTemplates: () => Promise<void>;
  loadTemplate: (id: string) => Promise<DocxTemplateDetail>;
  uploadTemplate: (file: File) => Promise<DocxTemplateDetail>;
  saveTemplate: (id: string, input: DocxTemplateUpdateInput) => Promise<DocxTemplateDetail>;
  deleteTemplate: (id: string) => Promise<void>;
  convertTemplate: (id: string, input: DocxConvertInput) => Promise<DocxAnchorStatus[]>;
  uploadDiffFile: (side: DiffSide, file: File) => Promise<void>;
  deleteDiffUpload: (side: DiffSide) => Promise<void>;
  runDiff: () => Promise<void>;
  setDiffOverride: (side: DiffSide, overrideText: string | null) => Promise<void>;
  clearError: () => void;
}

async function ensureOk(response: Response, fallback: string) {
  if (response.ok) {
    return response;
  }

  const payload = await response.json().catch(() => null);
  throw new Error(payload?.error || fallback);
}

function parseAnchorResults(response: Response) {
  const raw = response.headers.get('X-Docx-Anchor-Results');

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(decodeURIComponent(raw)) as DocxAnchorStatus[];
  } catch {
    return [];
  }
}

function parseDownloadName(response: Response, fallbackName: string) {
  const disposition = response.headers.get('Content-Disposition') || '';
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallbackName;
}

async function downloadBlobResponse(response: Response, fallbackName: string) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = parseDownloadName(response, fallbackName);
  link.click();
  window.URL.revokeObjectURL(url);
}

function replaceSummary(list: DocxTemplateSummary[], detail: DocxTemplateDetail) {
  const summary: DocxTemplateSummary = {
    id: detail.id,
    filename: detail.filename,
    display_name: detail.display_name,
    updated_at: detail.updated_at,
  };
  const next = list.filter((item) => item.id !== detail.id);
  next.unshift(summary);
  return next;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  templates: [],
  activeTemplate: null,
  diffUploads: {
    left: null,
    right: null,
  },
  diffResult: null,
  error: null,
  listLoading: false,
  detailLoading: false,
  uploadLoading: false,
  saveLoading: false,
  convertLoading: false,
  diffLoading: false,

  fetchTemplates: async () => {
    set({ listLoading: true, error: null });

    try {
      const response = await ensureOk(await fetch('/api/documents/templates'), '보관된 양식을 불러오지 못했어요.');
      const templates = await response.json() as DocxTemplateSummary[];
      set({ templates, listLoading: false });
    } catch (error) {
      set({
        listLoading: false,
        error: error instanceof Error ? error.message : '보관된 양식을 불러오지 못했어요.',
      });
      throw error;
    }
  },

  loadTemplate: async (id) => {
    set({ detailLoading: true, error: null });

    try {
      const response = await ensureOk(await fetch(`/api/documents/templates/${id}`), '양식을 여는 데 실패했어요.');
      const detail = await response.json() as DocxTemplateDetail;
      set((state) => ({
        activeTemplate: detail,
        templates: replaceSummary(state.templates, detail),
        detailLoading: false,
      }));
      return detail;
    } catch (error) {
      set({
        detailLoading: false,
        error: error instanceof Error ? error.message : '양식을 여는 데 실패했어요.',
      });
      throw error;
    }
  },

  uploadTemplate: async (file) => {
    set({ uploadLoading: true, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await ensureOk(
        await fetch('/api/documents/templates', {
          method: 'POST',
          body: formData,
        }),
        '파일을 올리지 못했어요. 워드 파일(.docx)인지 확인해주세요.',
      );
      const detail = await response.json() as DocxTemplateDetail;
      set((state) => ({
        uploadLoading: false,
        activeTemplate: detail,
        templates: replaceSummary(state.templates, detail),
      }));
      return detail;
    } catch (error) {
      set({
        uploadLoading: false,
        error: error instanceof Error ? error.message : '파일을 올리지 못했어요.',
      });
      throw error;
    }
  },

  saveTemplate: async (id, input) => {
    set({ saveLoading: true, error: null });

    try {
      const response = await ensureOk(
        await fetch(`/api/documents/templates/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        }),
        '변경한 내용을 저장하지 못했어요.',
      );
      const detail = await response.json() as DocxTemplateDetail;
      set((state) => ({
        saveLoading: false,
        activeTemplate: detail,
        templates: replaceSummary(state.templates, detail),
      }));
      return detail;
    } catch (error) {
      set({
        saveLoading: false,
        error: error instanceof Error ? error.message : '변경한 내용을 저장하지 못했어요.',
      });
      throw error;
    }
  },

  deleteTemplate: async (id) => {
    set({ error: null });

    try {
      await ensureOk(
        await fetch(`/api/documents/templates/${id}`, {
          method: 'DELETE',
        }),
        '양식을 삭제하지 못했어요.',
      );

      set((state) => ({
        templates: state.templates.filter((item) => item.id !== id),
        activeTemplate: state.activeTemplate?.id === id ? null : state.activeTemplate,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '양식을 삭제하지 못했어요.',
      });
      throw error;
    }
  },

  convertTemplate: async (id, input) => {
    set({ convertLoading: true, error: null });

    try {
      const response = await ensureOk(
        await fetch(`/api/documents/templates/${id}/convert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        }),
        '문서를 만드는 데 실패했어요. 입력값을 확인해주세요.',
      );
      const anchorResults = parseAnchorResults(response);
      const fallbackName = `${input.companyName || 'document'}.docx`;
      await downloadBlobResponse(response, fallbackName);
      set({ convertLoading: false });
      return anchorResults;
    } catch (error) {
      set({
        convertLoading: false,
        error: error instanceof Error ? error.message : '문서를 만드는 데 실패했어요.',
      });
      throw error;
    }
  },

  uploadDiffFile: async (side, file) => {
    set({ diffLoading: true, error: null });

    try {
      const previousUpload = get().diffUploads[side];
      const formData = new FormData();
      formData.append('file', file);

      const response = await ensureOk(
        await fetch('/api/documents/diff/upload', {
          method: 'POST',
          body: formData,
        }),
        '파일을 올리지 못했어요.',
      );
      const upload = await response.json() as DocxDiffUpload;

      if (previousUpload) {
        await fetch(`/api/documents/diff/${previousUpload.id}`, { method: 'DELETE' }).catch(() => null);
      }

      set((state) => ({
        diffLoading: false,
        diffResult: null,
        diffUploads: {
          ...state.diffUploads,
          [side]: upload,
        },
      }));
    } catch (error) {
      set({
        diffLoading: false,
        error: error instanceof Error ? error.message : '파일을 올리지 못했어요.',
      });
      throw error;
    }
  },

  deleteDiffUpload: async (side) => {
    const upload = get().diffUploads[side];

    if (!upload) {
      return;
    }

    set({ error: null });

    try {
      await ensureOk(
        await fetch(`/api/documents/diff/${upload.id}`, {
          method: 'DELETE',
        }),
        '파일을 빼지 못했어요.',
      );
      set((state) => ({
        diffResult: null,
        diffUploads: {
          ...state.diffUploads,
          [side]: null,
        },
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '파일을 빼지 못했어요.',
      });
      throw error;
    }
  },

  runDiff: async () => {
    const { left, right } = get().diffUploads;

    if (!left?.id || !right?.id) {
      const error = new Error('비교하려면 두 워드 파일을 모두 올려주세요.');
      set({ error: error.message });
      throw error;
    }

    set({ diffLoading: true, error: null });

    try {
      const response = await ensureOk(
        await fetch('/api/documents/diff/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leftId: left.id,
            rightId: right.id,
          }),
        }),
        '문서를 비교하지 못했어요.',
      );
      const diffResult = await response.json() as DocxDiffResult;
      set({ diffLoading: false, diffResult });
    } catch (error) {
      set({
        diffLoading: false,
        error: error instanceof Error ? error.message : '문서를 비교하지 못했어요.',
      });
      throw error;
    }
  },

  setDiffOverride: async (side, overrideText) => {
    const upload = get().diffUploads[side];
    if (!upload) return;

    set({ error: null });

    try {
      const response = await ensureOk(
        await fetch(`/api/documents/diff/${upload.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overridden_text: overrideText }),
        }),
        'OCR 결과를 저장하지 못했습니다.',
      );
      const updated = await response.json() as DocxDiffUpload;

      set((state) => ({
        diffResult: null,
        diffUploads: {
          ...state.diffUploads,
          [side]: updated,
        },
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'OCR 결과를 저장하지 못했습니다.',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
