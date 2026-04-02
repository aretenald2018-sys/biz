export interface Attachment {
  id: string;
  parent_type: 'annotation' | 'meta_annotation';
  parent_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  is_image: number;
  created_at: string;
  /** Base64 data URL — only populated when fetched */
  data_url?: string;
}

export interface MetaAnnotationReply {
  id: string;
  meta_annotation_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface MetaAnnotation {
  id: string;
  annotation_id: string;
  start_offset: number;
  end_offset: number;
  selected_text: string;
  note: string;
  color: string;
  resolved: number;
  created_at: string;
  updated_at: string;
  replies?: MetaAnnotationReply[];
  attachments?: Attachment[];
}

export interface AnnotationReply {
  id: string;
  annotation_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Annotation {
  id: string;
  email_id: string;
  note_id?: string;
  start_offset: number;
  end_offset: number;
  selected_text: string;
  note: string;
  color: string;
  resolved: number;
  created_at: string;
  updated_at: string;
  replies?: AnnotationReply[];
  meta_annotations?: MetaAnnotation[];
  attachments?: Attachment[];
}

export interface CreateAnnotationInput {
  email_id?: string;
  note_id?: string;
  start_offset: number;
  end_offset: number;
  selected_text: string;
  note: string;
  color?: string;
}

export interface UpdateAnnotationInput {
  note?: string;
  color?: string;
  resolved?: number;
}

export interface CreateMetaAnnotationInput {
  annotation_id: string;
  start_offset: number;
  end_offset: number;
  selected_text: string;
  note: string;
  color?: string;
}
