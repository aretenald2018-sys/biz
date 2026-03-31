import { create } from 'zustand';
import type { Annotation, CreateAnnotationInput, UpdateAnnotationInput, CreateMetaAnnotationInput, Attachment } from '@/types/annotation';

interface AnnotationStore {
  annotations: Annotation[];
  activeAnnotation: string | null;
  activeMetaAnnotation: string | null;
  loading: boolean;

  fetchAnnotations: (ticketId: string, emailId: string) => Promise<void>;
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

  // Attachment actions
  uploadAttachment: (ticketId: string, parentType: 'annotation' | 'meta_annotation', parentId: string, file: File) => Promise<void>;
  deleteAttachment: (ticketId: string, attachmentId: string) => Promise<void>;
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],
  activeAnnotation: null,
  activeMetaAnnotation: null,
  loading: false,

  fetchAnnotations: async (ticketId: string, emailId: string) => {
    set({ loading: true });
    const res = await fetch(`/api/tickets/${ticketId}/annotations?email_id=${emailId}`);
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
      await get().fetchAnnotations(ticketId, input.email_id);
    }
  },

  updateAnnotation: async (ticketId: string, annotationId: string, input: UpdateAnnotationInput) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
    }
  },

  deleteAnnotation: async (ticketId: string, annotationId: string) => {
    const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
    await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}`, { method: 'DELETE' });
    if (emailId) await get().fetchAnnotations(ticketId, emailId);
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
      const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
    }
  },

  updateReply: async (ticketId: string, annotationId: string, replyId: string, note: string) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/replies/${replyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
    }
  },

  deleteReply: async (ticketId: string, annotationId: string, replyId: string) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/replies/${replyId}`, { method: 'DELETE' });
    if (res.ok) {
      const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
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
      const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
    }
  },

  updateMetaAnnotation: async (ticketId, annotationId, metaId, input) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
    }
  },

  deleteMetaAnnotation: async (ticketId, annotationId, metaId) => {
    await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}`, { method: 'DELETE' });
    const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
    if (emailId) await get().fetchAnnotations(ticketId, emailId);
  },

  // Meta-annotation replies
  addMetaReply: async (ticketId, annotationId, metaId, note) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
    }
  },

  updateMetaReply: async (ticketId, annotationId, metaId, replyId, note) => {
    const res = await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}/replies/${replyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
    }
  },

  deleteMetaReply: async (ticketId, annotationId, metaId, replyId) => {
    await fetch(`/api/tickets/${ticketId}/annotations/${annotationId}/meta/${metaId}/replies/${replyId}`, { method: 'DELETE' });
    const emailId = get().annotations.find(a => a.id === annotationId)?.email_id;
    if (emailId) await get().fetchAnnotations(ticketId, emailId);
  },

  // Attachments
  uploadAttachment: async (ticketId, parentType, parentId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parent_type', parentType);
    formData.append('parent_id', parentId);

    const res = await fetch('/api/attachments', { method: 'POST', body: formData });
    if (res.ok) {
      // Re-fetch all annotations to get updated attachment lists
      const emailId = get().annotations[0]?.email_id;
      if (emailId) await get().fetchAnnotations(ticketId, emailId);
    }
  },

  deleteAttachment: async (ticketId, attachmentId) => {
    await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
    const emailId = get().annotations[0]?.email_id;
    if (emailId) await get().fetchAnnotations(ticketId, emailId);
  },
}));
