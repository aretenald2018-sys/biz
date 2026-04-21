export type KdpBrand = 'hyundai' | 'kia';

export const KDP_BRANDS: KdpBrand[] = ['hyundai', 'kia'];

export const KDP_BRAND_LABELS: Record<KdpBrand, string> = {
  hyundai: '현대',
  kia: '기아',
};

export const KDP_SOURCE_URLS: Record<KdpBrand, string> = {
  hyundai: 'https://privacy.hyundai.com/kr/ko/overview/full-policy',
  kia: 'https://privacy.kia.com/kr/ko/overview/full-policy',
};

export type KdpCategory =
  | 'collection_item'
  | 'retention'
  | 'third_party'
  | 'overseas'
  | 'entrust'
  | 'cookie'
  | 'auto_decision'
  | 'rights'
  | 'security'
  | 'dpo'
  | 'other';

export const KDP_CATEGORY_LABELS: Record<KdpCategory, string> = {
  collection_item: '수집항목',
  retention: '보유기간',
  third_party: '제3자 제공',
  overseas: '국외 이전',
  entrust: '처리 위탁',
  cookie: '쿠키',
  auto_decision: '자동화 의사결정',
  rights: '정보주체 권리',
  security: '안전성 확보조치',
  dpo: '보호책임자',
  other: '기타',
};

export const KDP_CATEGORIES: KdpCategory[] = [
  'collection_item',
  'retention',
  'third_party',
  'overseas',
  'entrust',
  'cookie',
  'auto_decision',
  'rights',
  'security',
  'dpo',
  'other',
];

export type KdpSourceMode = 'fetch' | 'manual';

export interface KdpPolicy {
  id: number;
  brand: KdpBrand;
  source_url: string;
  source_mode: KdpSourceMode;
  fetched_at: string;
  title: string | null;
  version_hash: string;
  plain_text_len: number;
}

export interface KdpSection {
  id: number;
  policy_id: number;
  parent_id: number | null;
  order_idx: number;
  heading_level: number;
  heading: string;
  anchor_slug: string;
  path_text: string | null;
  category: KdpCategory;
  text: string;
}

export interface KdpModal {
  id: number;
  policy_id: number;
  link_key: string;
  label: string;
  title: string | null;
  html: string;
  text: string;
  anchored_section_id: number | null;
  category: KdpCategory;
}

export interface KdpChunk {
  id: number;
  policy_id: number;
  section_id: number | null;
  modal_id: number | null;
  ord: number;
  text: string;
  category: KdpCategory;
  heading_path: string | null;
}

export interface KdpCitation {
  chunk_id: number;
  excerpt: string;
  confidence?: number | null;
}

export interface KdpQaLog {
  id: number;
  policy_id: number;
  brand: KdpBrand;
  question: string;
  answer: string;
  citations: KdpCitation[];
  model: string;
  created_at: string;
  starred: number;
  category: KdpCategory | null;
}

export interface KdpDiffEntry {
  id: number;
  brand: KdpBrand;
  from_policy_id: number;
  to_policy_id: number;
  created_at: string;
  summary: {
    added: number;
    removed: number;
    changed: number;
  };
}

export interface KdpPolicyDetail {
  policy: KdpPolicy;
  sections: KdpSection[];
  modals: KdpModal[];
  chunks: KdpChunk[];
}

export interface KdpRefreshResult {
  ok: boolean;
  policy?: KdpPolicy;
  reason?: 'empty_body' | 'network' | 'parse_error';
  message?: string;
}

export interface KdpAskRequest {
  brand: KdpBrand;
  question: string;
  category?: KdpCategory | null;
}

export interface KdpAskResponse {
  answer: string;
  citations: KdpCitation[];
  log_id: number;
  model: string;
}

export interface KdpSectionInput {
  parent_id?: number | null;
  order_idx?: number;
  heading_level?: number;
  heading: string;
  anchor_slug?: string | null;
  category?: KdpCategory;
  text: string;
}

export interface KdpModalInput {
  link_key: string;
  label: string;
  title?: string | null;
  html?: string;
  text: string;
  anchored_section_id?: number | null;
  category?: KdpCategory;
}
