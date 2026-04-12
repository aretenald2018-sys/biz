export type Region = 'EU' | 'NA' | 'IN';

export type Brand = 'hyundai' | 'kia' | 'genesis';

export type ServiceFamily =
  | 'website'
  | 'account_portal'
  | 'connected_services'
  | 'vehicle_tech'
  | 'navigation_update'
  | 'store_payment'
  | 'used_vehicle_locator'
  | 'service_app';

export type DocumentType =
  | 'privacy_policy'
  | 'privacy_notice'
  | 'terms_of_use'
  | 'data_rights'
  | 'cookie_notice'
  | 'collection_notice'
  | 'legal_disclaimer';

export type Channel =
  | 'html'
  | 'pdf'
  | 'download_index'
  | 'archive_index'
  | 'portal_auth'
  | 'guide';

export type MonitoringTier = 'P0_weekly' | 'P1_weekly' | 'P2_monthly';
export type VerificationStatus = 'unverified' | 'verified' | 'broken' | 'superseded';
export type Requirement = 'required' | 'optional' | 'not_applicable' | 'unknown';
export type ChangeKind = 'none' | 'normalized_change' | 'raw_only_change' | 'new';
export type CaptureSource = 'auto_fetch' | 'manual_upload';
export type CandidateStatus = 'pending' | 'promoted' | 'rejected' | 'duplicate';
export type FactCategory = 'collectible_data' | 'collection_purpose' | 'transfer_purpose';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 're_review_required' | 'stale';
export type TransferStatus = 'allowed' | 'not_allowed' | 'unclear' | 'conditional';
export type TransferMechanism = 'scc' | 'adequacy' | 'consent' | 'intra_group_agreement' | 'unknown';
export type TermsBoardColumnKey = FactCategory | 'korea_transfer';
export type TermsFactType = 'processing' | 'transfer';

export interface TermsTaxonomyItem {
  code: string;
  ko: string;
  en: string;
}

export interface TermsTaxonomy {
  service_family: TermsTaxonomyItem[];
  data: TermsTaxonomyItem[];
  purpose: TermsTaxonomyItem[];
  transfer_mechanism: TermsTaxonomyItem[];
}

export interface TermsMarketEntity {
  code: string;
  display_name: string;
  region: Region;
  country: string;
  brand: Brand;
  owner_team?: string;
  notes?: string;
}

export interface TermsController {
  code: string;
  legal_name: string;
  region?: string;
  jurisdiction?: string;
  notes?: string;
}

export interface TermsApplicabilityEntry {
  market_entity: string;
  service_family: ServiceFamily;
  document_type: DocumentType;
  requirement: Requirement;
  rationale?: string;
}

export interface TermsAsset {
  id: number;
  market_entity: string;
  controller_entity?: string | null;
  service_family: ServiceFamily;
  document_type: DocumentType;
  channel: Channel;
  url: string;
  language?: string | null;
  auth_required: boolean;
  monitoring_tier: MonitoringTier;
  verification_status: VerificationStatus;
  last_updated_text?: string | null;
  effective_date?: string | null;
  last_seen_at?: string | null;
  owner_team?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type TermsAssetInput = Omit<TermsAsset, 'id' | 'created_at' | 'updated_at'>;
export type TermsAssetPatchInput = Partial<TermsAssetInput>;

export interface TermsSeedAsset extends TermsAssetInput {
  brand: Brand;
}

export interface TermsAssetCandidate {
  id: number;
  discovered_at: string;
  source_url: string;
  candidate_url: string;
  anchor_text?: string | null;
  hint_market_entity?: string | null;
  hint_service_family?: ServiceFamily | null;
  hint_document_type?: DocumentType | null;
  status: CandidateStatus;
  promoted_asset_id?: number | null;
  rejected_reason?: string | null;
  reviewer?: string | null;
  reviewed_at?: string | null;
}

export interface TermsDocumentVersion {
  id: number;
  asset_id: number;
  captured_at: string;
  capture_source: CaptureSource;
  http_status?: number | null;
  etag?: string | null;
  last_modified_header?: string | null;
  raw_hash?: string | null;
  normalized_hash?: string | null;
  mime_type?: string | null;
  blob_path?: string | null;
  extracted_text_path?: string | null;
  extracted_last_updated?: string | null;
  diff_from_prev_id?: number | null;
  change_kind?: ChangeKind | null;
  uploaded_by?: string | null;
}

export interface TermsClause {
  id: number;
  version_id: number;
  path?: string | null;
  heading?: string | null;
  body: string;
  language?: string | null;
  order_index: number;
  char_start?: number | null;
  char_end?: number | null;
}

export interface TermsProcessingFact {
  id: number;
  market_entity: string;
  controller_entity?: string | null;
  service_family: ServiceFamily;
  category: FactCategory;
  taxonomy_code: string;
  display_label?: string | null;
  condition?: string | null;
  confidence?: number | null;
  review_status: ReviewStatus;
  reviewer?: string | null;
  reviewed_at?: string | null;
  latest_version_id?: number | null;
  manual_entry?: number;
  created_at: string;
}

export interface TermsTransferFact {
  id: number;
  market_entity: string;
  controller_entity?: string | null;
  service_family: ServiceFamily;
  data_taxonomy_code?: string | null;
  purpose_taxonomy_code?: string | null;
  destination_country: string;
  recipient_entity?: string | null;
  transfer_mechanism?: TransferMechanism | null;
  legal_basis?: string | null;
  status: TransferStatus;
  condition?: string | null;
  confidence?: number | null;
  review_status: ReviewStatus;
  reviewer?: string | null;
  reviewed_at?: string | null;
  latest_version_id?: number | null;
  manual_entry?: number;
  created_at: string;
}

export interface TermsFactEvidence {
  fact_type: TermsFactType;
  fact_id: number;
  clause_id: number;
  excerpt?: string | null;
}

export interface TermsEvidenceItem {
  clause_id: number;
  order_index: number;
  heading?: string | null;
  path?: string | null;
  excerpt?: string | null;
  body: string;
}

export interface TermsDiffSegment {
  kind: 'equal' | 'insert' | 'delete';
  text: string;
}

export interface TermsDocumentDiff {
  version_id: number;
  prev_id?: number | null;
  segments: TermsDiffSegment[];
}

export interface TermsBoardCard {
  id: number;
  kind: TermsFactType;
  taxonomy_code: string;
  display_label: string;
  condition?: string | null;
  transfer_status?: TransferStatus | null;
  review_status: ReviewStatus;
  evidence_count: number;
  service_family: ServiceFamily;
  latest_version_id?: number | null;
  confidence?: number | null;
  manual_entry?: boolean;
  source_asset_id?: number | null;
  source_document_type?: DocumentType | null;
  source_asset_url?: string | null;
}

export interface TermsBoardCardDetail extends TermsBoardCard {
  market_entity: string;
  controller_entity?: string | null;
  destination_country?: string | null;
  recipient_entity?: string | null;
  transfer_mechanism?: TransferMechanism | null;
  legal_basis?: string | null;
  confidence?: number | null;
  reviewer?: string | null;
  reviewed_at?: string | null;
  evidence: TermsEvidenceItem[];
  diff?: TermsDocumentDiff | null;
}

export interface TermsBoardResponse {
  columns: Record<TermsBoardColumnKey, TermsBoardCard[]>;
  details: Record<string, TermsBoardCardDetail>;
}

export interface TermsReviewProcessingItem extends TermsProcessingFact {
  evidence: TermsEvidenceItem[];
  market_entity_display?: string;
  controller_name?: string | null;
  latest_version?: TermsDocumentVersion | null;
  diff?: TermsDocumentDiff | null;
}

export interface TermsReviewTransferItem extends TermsTransferFact {
  evidence: TermsEvidenceItem[];
  market_entity_display?: string;
  controller_name?: string | null;
  latest_version?: TermsDocumentVersion | null;
  diff?: TermsDocumentDiff | null;
}

export interface TermsReviewQueueResponse {
  processing: TermsReviewProcessingItem[];
  transfer: TermsReviewTransferItem[];
}

export interface GapReportEntry {
  market_entity: string;
  service_family: ServiceFamily;
  document_type: DocumentType;
  requirement: Requirement;
  status: 'missing' | 'broken' | 'ok' | 'na';
  rationale?: string | null;
}

export interface TermsInboxItem {
  type: 'candidate' | 'gap' | 'change' | 're_review';
  title: string;
  summary: string;
  href: string;
}

export interface TermsInboxSummary {
  changes: number;
  gaps: number;
  re_review: number;
  candidates: number;
  items: TermsInboxItem[];
}

export interface TermsExtractResult {
  processing: number;
  transfer: number;
}

export interface TermsDiscoveryResult {
  candidates_added: number;
}

export interface TermsCaptureNotModified {
  asset_id: number;
  status: 304;
  change_kind: 'none';
}

export type TermsCaptureResult = TermsDocumentVersion | TermsCaptureNotModified;
