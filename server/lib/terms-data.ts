import fs from 'node:fs';
import path from 'node:path';
import type {
  DocumentType,
  ServiceFamily,
  TermsApplicabilityEntry,
  TermsController,
  TermsMarketEntity,
  TermsSeedAsset,
  TermsTaxonomy,
} from '@/types/terms';

const DATA_DIR = path.resolve(process.cwd(), 'data');

const TERMS_SERVICE_LABELS: Record<ServiceFamily, string> = {
  'website': '웹사이트',
  'account_portal': '계정 포털',
  'connected_services': '커넥티드 서비스',
  'vehicle_tech': '차량 기술',
  'navigation_update': '내비 업데이트',
  'store_payment': '스토어결제',
  'used_vehicle_locator': '중고차 조회',
  'service_app': '서비스 앱',
};

const TERMS_DOCUMENT_LABELS: Record<DocumentType, string> = {
  'privacy_policy': 'Privacy Policy',
  'privacy_notice': 'Privacy Notice',
  'terms_of_use': 'Terms of Use',
  'data_rights': 'Data Rights',
  'cookie_notice': 'Cookie Notice',
  'collection_notice': 'Collection Notice',
  'legal_disclaimer': 'Legal Disclaimer',
};

function readJsonFile<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function loadTermsTaxonomy() {
  return readJsonFile<TermsTaxonomy>('terms-taxonomy.json', {
    service_family: [],
    data: [],
    purpose: [],
    transfer_mechanism: [],
  });
}

export function loadTermsControllers() {
  return readJsonFile<TermsController[]>('terms-controllers.json', []);
}

export function loadTermsMarketEntities() {
  return readJsonFile<TermsMarketEntity[]>('terms-market-entities.json', []);
}

export function loadTermsApplicability() {
  return readJsonFile<TermsApplicabilityEntry[]>('terms-applicability-matrix.json', []);
}

export function loadTermsSeedAssets() {
  return readJsonFile<TermsSeedAsset[]>('terms-seed.json', []);
}

export function getTermsTaxonomyLabel(code: string) {
  const taxonomy = loadTermsTaxonomy();
  const item = [...taxonomy.service_family, ...taxonomy.data, ...taxonomy.purpose, ...taxonomy.transfer_mechanism]
    .find((entry) => entry.code === code);
  return item?.ko ?? code;
}

export function getTermsServiceLabel(value: ServiceFamily) {
  return TERMS_SERVICE_LABELS[value] ?? value;
}

export function getTermsDocumentLabel(value: DocumentType) {
  return TERMS_DOCUMENT_LABELS[value] ?? value;
}

export { TERMS_DOCUMENT_LABELS, TERMS_SERVICE_LABELS };
