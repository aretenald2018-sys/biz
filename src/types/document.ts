export type PlaceholderSource = 'original' | 'anchor';
export type AnchorMatchStatus = 'ready' | 'conflict' | 'failed';
export type DocxDiffLineType = 'equal' | 'modified' | 'added' | 'removed';

export interface DocxPlaceholderEntry {
  key: string;
  occurrences: number;
  source: PlaceholderSource;
}

export interface DocxAnchorInsert {
  key: string;
  beforeText: string;
  afterText: string;
}

export interface DocxAnchorStatus extends DocxAnchorInsert {
  status: AnchorMatchStatus;
  matches: number;
  message: string;
}

export interface DocxTemplateSummary {
  id: string;
  filename: string;
  display_name: string | null;
  updated_at: string;
}

export interface DocxTemplateDetail extends DocxTemplateSummary {
  created_at: string;
  preview_html: string;
  tiptap_html: string | null;
  placeholders: DocxPlaceholderEntry[];
  anchor_inserts: DocxAnchorInsert[];
}

export interface DocxTemplateUpdateInput {
  display_name?: string | null;
  tiptap_html?: string | null;
  anchor_inserts?: DocxAnchorInsert[];
}

export interface DocxConvertInput {
  companyName: string;
  values: Record<string, string>;
}

export type DocxDiffExtractionSource = 'docx' | 'pdf-text' | 'pdf-ocr' | 'pdf-override';

export interface DocxDiffUpload {
  id: string;
  filename: string;
  file_type: string | null;
  has_override: boolean;
  created_at: string;
}

export type DocxDiffSegmentType = 'equal' | 'insert' | 'delete';

export interface DocxDiffSegment {
  text: string;
  type: DocxDiffSegmentType;
}

export interface DocxDiffLine {
  left: string;
  right: string;
  leftSegments?: DocxDiffSegment[];
  rightSegments?: DocxDiffSegment[];
  type: DocxDiffLineType;
  diffIndex: number | null;
}

export interface DocxDiffStats {
  added: number;
  removed: number;
  modified: number;
  totalChanges: number;
}

export interface DocxDiffResult {
  leftFilename: string;
  rightFilename: string;
  lines: DocxDiffLine[];
  stats: DocxDiffStats;
  sources?: {
    left: DocxDiffExtractionSource;
    right: DocxDiffExtractionSource;
  };
  warnings?: string[];
}
