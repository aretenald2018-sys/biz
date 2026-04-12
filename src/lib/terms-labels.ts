import type {
  Brand,
  DocumentType,
  ReviewStatus,
  ServiceFamily,
  TransferStatus,
  VerificationStatus,
} from '@/types/terms';

export const TERMS_BRAND_LABELS: Record<Brand, string> = {
  hyundai: '현대',
  kia: '기아',
  genesis: '제네시스',
};

export const TERMS_SERVICE_LABELS: Record<ServiceFamily, string> = {
  website: '웹사이트',
  account_portal: '계정 포털',
  connected_services: '커넥티드 서비스',
  vehicle_tech: '차량 기술',
  navigation_update: '내비 업데이트',
  store_payment: '스토어결제',
  used_vehicle_locator: '중고차 조회',
  service_app: '서비스 앱',
};

export const TERMS_DOCUMENT_LABELS: Record<DocumentType, string> = {
  privacy_policy: '개인정보처리방침',
  privacy_notice: '개인정보 고지',
  terms_of_use: '이용약관',
  data_rights: '정보주체 권리',
  cookie_notice: '쿠키 고지',
  collection_notice: '수집 고지',
  legal_disclaimer: '법적 고지',
};

export function getTermsBrandLabel(value: Brand) {
  return TERMS_BRAND_LABELS[value] ?? value;
}

export function getTermsServiceLabel(value: ServiceFamily) {
  return TERMS_SERVICE_LABELS[value] ?? value;
}

export function getTermsDocumentLabel(value: DocumentType) {
  return TERMS_DOCUMENT_LABELS[value] ?? value;
}

export function getReviewStatusTone(status: ReviewStatus) {
  switch (status) {
    case 'approved':
      return 'border-[#002C5F]/20 bg-[#002C5F]/8 text-[#002C5F]';
    case 're_review_required':
      return 'border-[#EC8E01]/20 bg-[#EC8E01]/10 text-[#B86C00]';
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'stale':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700';
  }
}

export function getTransferStatusTone(status?: TransferStatus | null) {
  switch (status) {
    case 'allowed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'conditional':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'not_allowed':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

export function getVerificationStatusTone(status: VerificationStatus) {
  switch (status) {
    case 'verified':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'broken':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'superseded':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}
