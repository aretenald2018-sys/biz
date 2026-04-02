import { create } from 'zustand';
import type { Annotation, CreateAnnotationInput, UpdateAnnotationInput, CreateMetaAnnotationInput, Attachment } from '@/types/annotation';

interface AnnotationStore {
  annotations: Annotation[];
  activeAnnotation: string | null;
  activeMetaAnnotation: string | null;
  loading: boolean;

  fetchAnnotations: (ticketId: string, emailId: string, noteId?: string) => Promise<void>;
  createAnnotation: (ticketId: string, input: CreateAnnotationInput) => Promise<void>;
  updateAnnotation: (ticketId: string, annotationId: string, input: UpdateAnnotationInput) => Promise<void>;
  deleteAnnotation: (ticketId: string, annotationId: string) => Promise<void>;
  setActiveAnnotation: (id: string | null) => void;
  setActiveMetaAnnotation: (id: string | null) => void;

  // Reply actions (on annotations — kept for backward compat)
  addReply: (ticketId: string, annotationId: string, note: string) => Promise<void>;
  updateReply: (ticketId: string, annotationId: string, replyId: string, note: string) => Promise<void>;
  deleteReply: (ticketId: string, annotationId: string, replyId: string) => Promise<void>;

  // Meta-annotation actions
  createMetaAnnotation: (ticketId: string, annotationId: string, input: Omit<CreateMetaAnnotationInput, 'annotation_id'>) => Promise<void>;
  updateMetaAnnotation: (ticketId: string, annotationId: string, metaId: string, input: UpdateAnnotationInput) => Promise<void>;
  deleteMetaAnnotation: (ticketId: string, annotationId: string, metaId: string) => Promise<void>;

  // Meta-annotation reply actions
  addMetaReply: (ticketId: string, annotationId: string, metaId: string, note: string) => Promise<void>;
  updateMetaReply: (ticketId: string, annotationId: string, metaId: string, replyId: string, note: string) => Promise<void>;
  deleteMetaReply: (ticketId: string, annotationId: string, metaId: string, replyId: string) => Promise<void>;

  // Resolve actions
  toggleResolveAnnotation: (ticketId: string, annotationId: string) => Promise<void>;
  toggleResolveMetaAnnotation: (ticketId: string, annotationId: string, metaId: string) => Promise<void>;

  // Attachment actions
  uploadAttachment: (ticketId: string, parentType: 'annotation' | 'meta_annotation', parentId: string, file: File) => Promise<void>;
  deleteAttachment: (ticketId: string, attachmentId: string) => Promise<void>;
}

const refetchForAnnotation = async (get: () => AnnotationStore, ticketId: string, annotationId: string) => {
  const ann = get().annotations.find(a => a.id === annotationId);
  if (ann?.email_id) await get().fetchAnnotations(ticketId, ann.email_id);
  else if (ann?.note_id) await get().fetchAnnotations(ticketId, '', ann.note_id);
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],
  activeAnnotation: null,
  activeMetaAnnotation: null,
  loading: false,

  fetchAnnotations: async (ticketId: string, emailId: string, noteId?: string) => {
    set({ loading: true });
    const param = noteId ? `note_id=${noteId}` : `email_id=${emailId}`;
    const res = await fetch(`/api/tickets/${ticketId}/annotations?${param}`);
    if (res.ok) {
      const annotations = await res.json();
      set({ annotations, loading: false });
    } else {
      set({ loading: false });
    }
  },

  createAnnotation: async (ticketId: string, input: CreateAnnotationInput) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      if (input.email_id) {
        await get().fetchAnnotations(ticketId, input.email_id);
      } else if (input.note_id) {
        await get().fetchAnnotations(ticketId, '', input.note_id);
      }
    }
  },

  updateAnnotation: async (ticketId: string, annotationId: string, input: UpdateAnnotationInput) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  deleteAnnotation: async (ticketId: string, annotationId: string) => {
    const ann = get().annotations.find(a => a.id === annotationId);
    await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}`, { method: 'DELETE' });
    if (ann?.email_id) await get().fetchAnnotations(ticketId, ann.email_id);
    else if (ann?.note_id) await get().fetchAnnotations(ticketId, '', ann.note_id);
  },

  setActiveAnnotation: (id: string | null) => {
    set({ activeAnnotation: id, activeMetaAnnotation: null });
  },

  setActiveMetaAnnotation: (id: string | null) => {
    set({ activeMetaAnnotation: id });
  },

  addReply: async (ticketId: string, annotationId: string, note: string) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  updateReply: async (ticketId: string, annotationId: string, replyId: string, note: string) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/replies/${replyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  deleteReply: async (ticketId: string, annotationId: string, replyId: string) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/replies/${replyId}`, { method: 'DELETE' });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  // Meta-annotation CRUD
  createMetaAnnotation: async (ticketId, annotationId, input) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  updateMetaAnnotation: async (ticketId, annotationId, metaId, input) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  deleteMetaAnnotation: async (ticketId, annotationId, metaId) => {
    await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}`, { method: 'DELETE' });
    await refetchForAnnotation(get, ticketId, annotationId);
  },

  // Meta-annotation replies
  addMetaReply: async (ticketId, annotationId, metaId, note) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  updateMetaReply: async (ticketId, annotationId, metaId, replyId, note) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}/replies/${replyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  deleteMetaReply: async (ticketId, annotationId, metaId, replyId) => {
    await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}/replies/${replyId}`, { method: 'DELETE' });
    await refetchForAnnotation(get, ticketId, annotationId);
  },

  // Resolve toggle
  toggleResolveAnnotation: async (ticketId, annotationId) => {
    const ann = get().annotations.find(a => a.id === annotationId);
    if (!ann) return;
    const newResolved = ann.resolved ? 0 : 1;
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: newResolved }),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  toggleResolveMetaAnnotation: async (ticketId, annotationId, metaId) => {
    const ann = get().annotations.find(a => a.id === annotationId);
    const meta = ann?.meta_annotations?.find(m => m.id === metaId);
    if (!meta) return;
    const newResolved = meta.resolved ? 0 : 1;
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: newResolved }),
    });
    if (res.ok) {
      await refetchForAnnotation(get, ticketId, annotationId);
    }
  },

  // Attachments
  uploadAttachment: async (ticketId, parentType, parentId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parent_type', parentType);
    formData.append('parent_id', parentId);

    const res = await fetch('/api/attachments', { method: 'POST', body: formData });
    if (res.ok) {
      const first = get().annotations[0];
      if (first?.email_id) await get().fetchAnnotations(ticketId, first.email_id);
      else if (first?.note_id) await get().fetchAnnotations(ticketId, '', first.note_id);
    }
  },

  deleteAttachment: async (ticketId, attachmentId) => {
    await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
    const first = get().annotations[0];
    if (first?.email_id) await get().fetchAnnotations(ticketId, first.email_id);
    else if (first?.note_id) await get().fetchAnnotations(ticketId, '', first.note_id);
  },
}));
