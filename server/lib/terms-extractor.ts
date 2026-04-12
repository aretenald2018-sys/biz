import type {
  FactCategory,
  ReviewStatus,
  ServiceFamily,
  TermsClause,
  TransferMechanism,
  TransferStatus,
} from '@/types/terms';
import { getTermsTaxonomyLabel, loadTermsApplicability, loadTermsControllers, loadTermsTaxonomy } from './terms-data';
import { normalizeWhitespace } from './terms-text';

interface ClauseRef extends Pick<TermsClause, 'order_index' | 'body' | 'heading' | 'path'> {}

interface ExtractedEvidence {
  order_index: number;
  excerpt?: string;
}

export interface ExtractedProcessingFact {
  category: FactCategory;
  taxonomy_code: string;
  condition?: string;
  confidence: number;
  evidence: ExtractedEvidence[];
}

export interface ExtractedTransferFact {
  data_taxonomy_code?: string;
  purpose_taxonomy_code?: string;
  destination_country: string;
  recipient_entity?: string;
  transfer_mechanism?: TransferMechanism;
  legal_basis?: string;
  status: TransferStatus;
  condition?: string;
  confidence: number;
  evidence: ExtractedEvidence[];
}

export interface ExtractedTermsFacts {
  processing_facts: ExtractedProcessingFact[];
  transfer_facts: ExtractedTransferFact[];
}

const DATA_PATTERNS: Array<{ code: string; patterns: RegExp[] }> = [
  { code: 'data.account_id', patterns: [/\baccount\b/i, /\blogin\b/i, /\buser id\b/i, /\busername\b/i] },
  { code: 'data.contact', patterns: [/\bcontact\b/i, /\bemail\b/i, /\bphone\b/i, /\baddress\b/i] },
  { code: 'data.vin', patterns: [/\bvin\b/i, /\bvehicle identification number\b/i] },
  { code: 'data.vehicle_diagnostics', patterns: [/\bdiagnostic/i, /\bvehicle status\b/i, /\btelematics\b/i] },
  { code: 'data.driving_behavior', patterns: [/\bdriving\b/i, /\bdriving behavior\b/i, /\btrip\b/i] },
  { code: 'data.precise_location', patterns: [/\bprecise location\b/i, /\bgps\b/i, /\blocation data\b/i] },
  { code: 'data.app_device', patterns: [/\bdevice\b/i, /\bapp\b/i, /\bip address\b/i, /\bcookie\b/i] },
  { code: 'data.payment', patterns: [/\bpayment\b/i, /\bcredit card\b/i, /\bbilling\b/i] },
  { code: 'data.voice_recording', patterns: [/\bvoice recording\b/i, /\bvoice\b/i] },
  { code: 'data.call_recording', patterns: [/\bcall recording\b/i, /\bcall center recording\b/i, /\brecorded calls\b/i] },
];

const PURPOSE_PATTERNS: Array<{ code: string; patterns: RegExp[] }> = [
  { code: 'purpose.service_provision', patterns: [/\bservice provision\b/i, /\bprovide services?\b/i, /\bdeliver services?\b/i] },
  { code: 'purpose.remote_control', patterns: [/\bremote control\b/i, /\bremote access\b/i, /\bunlock\b/i, /\bstart your vehicle\b/i] },
  { code: 'purpose.safety_sos', patterns: [/\bsafety\b/i, /\bsos\b/i, /\bemergency\b/i, /\broadside\b/i] },
  { code: 'purpose.maintenance', patterns: [/\bmaintenance\b/i, /\bservice reminder\b/i, /\brepair\b/i] },
  { code: 'purpose.analytics_improvement', patterns: [/\banalytics\b/i, /\bimprove\b/i, /\bimprovement\b/i, /\bdevelop\b/i] },
  { code: 'purpose.marketing', patterns: [/\bmarketing\b/i, /\bpromotion\b/i, /\badvertising\b/i] },
  { code: 'purpose.legal_obligation', patterns: [/\blegal obligation\b/i, /\bcomply with law\b/i, /\blegal requirements?\b/i] },
  { code: 'purpose.payment_processing', patterns: [/\bpayment processing\b/i, /\bprocess payments?\b/i, /\bbilling\b/i] },
  { code: 'purpose.customer_support', patterns: [/\bcustomer support\b/i, /\bsupport request\b/i, /\bcontact center\b/i] },
];

const COUNTRY_PATTERNS: Array<{ code: string; patterns: RegExp[] }> = [
  { code: 'KR', patterns: [/\bkorea\b/i, /\brepublic of korea\b/i, /\bhyundai motor company\b/i, /\bheadquarters\b/i, /\bhq\b/i] },
  { code: 'US', patterns: [/\bunited states\b/i, /\busa\b/i, /\bus\b/i] },
  { code: 'CA', patterns: [/\bcanada\b/i] },
  { code: 'MX', patterns: [/\bmexico\b/i] },
  { code: 'DE', patterns: [/\bgermany\b/i, /\bdeutschland\b/i] },
  { code: 'GB', patterns: [/\bunited kingdom\b/i, /\buk\b/i, /\bgreat britain\b/i] },
  { code: 'IN', patterns: [/\bindia\b/i] },
  { code: 'EU', patterns: [/\beuropean union\b/i, /\beu\b/i] },
];

export async function extractTermsFacts(input: {
  market_entity: string;
  service_family: ServiceFamily;
  controller_entity?: string | null;
  clauses: ClauseRef[];
}): Promise<ExtractedTermsFacts> {
  const anthropicResult = await tryAnthropicExtraction(input);
  if (anthropicResult && (anthropicResult.processing_facts.length > 0 || anthropicResult.transfer_facts.length > 0)) {
    return anthropicResult;
  }

  return extractHeuristically(input);
}

function extractHeuristically(input: {
  market_entity: string;
  service_family: ServiceFamily;
  clauses: ClauseRef[];
}): ExtractedTermsFacts {
  const processingMap = new Map<string, ExtractedProcessingFact>();
  const transferMap = new Map<string, ExtractedTransferFact>();

  input.clauses.forEach((clause) => {
    const haystack = normalizeWhitespace([clause.heading, clause.path, clause.body].filter(Boolean).join(' '));
    const lowerHaystack = haystack.toLowerCase();
    const hasCollectionVerb = /\b(collect|gather|obtain|receive|store|record|capture|register)\b/i.test(haystack);
    const hasUseVerb = /\b(use|used|purpose|provide|deliver|support|maintain|analy[sz]e|improve|market)\b/i.test(haystack);
    const hasTransferVerb = /\b(share|transfer|disclos|provide to|send to|recipient|third part(y|ies)|affiliate)\b/i.test(haystack);
    const condition = extractCondition(clause.body);

    const dataMatches = DATA_PATTERNS.filter((entry) => entry.patterns.some((pattern) => pattern.test(haystack)));
    const purposeMatches = PURPOSE_PATTERNS.filter((entry) => entry.patterns.some((pattern) => pattern.test(haystack)));

    if (hasCollectionVerb || /\bwe collect\b/i.test(haystack)) {
      dataMatches.forEach((entry) => {
        upsertProcessingFact(processingMap, {
          category: 'collectible_data',
          taxonomy_code: entry.code,
          condition,
          confidence: lowerHaystack.includes('we collect') ? 0.9 : 0.8,
          evidence: [buildEvidence(clause)],
        });
      });
    }

    if (hasUseVerb) {
      purposeMatches.forEach((entry) => {
        upsertProcessingFact(processingMap, {
          category: 'collection_purpose',
          taxonomy_code: entry.code,
          condition,
          confidence: /\bfor\b/i.test(haystack) ? 0.86 : 0.78,
          evidence: [buildEvidence(clause)],
        });
      });
    }

    if (hasTransferVerb) {
      purposeMatches.forEach((entry) => {
        upsertProcessingFact(processingMap, {
          category: 'transfer_purpose',
          taxonomy_code: entry.code,
          condition,
          confidence: 0.76,
          evidence: [buildEvidence(clause)],
        });
      });
    }

    if (hasTransferVerb) {
      const destinations = detectCountries(haystack);
      const transferMechanism = detectTransferMechanism(haystack);
      const legalBasis = detectLegalBasis(haystack);
      const recipientEntity = detectRecipientEntity(haystack);
      const status = determineTransferStatus(haystack, destinations, condition);

      const dataCandidates = dataMatches.length > 0 ? dataMatches.map((entry) => entry.code) : [undefined];
      const purposeCandidates = purposeMatches.length > 0 ? purposeMatches.map((entry) => entry.code) : [undefined];
      const destinationCandidates = destinations.length > 0 ? destinations : ['unknown'];

      dataCandidates.slice(0, 2).forEach((dataTaxonomyCode) => {
        purposeCandidates.slice(0, 2).forEach((purposeTaxonomyCode) => {
          destinationCandidates.forEach((destinationCountry) => {
            upsertTransferFact(transferMap, {
              data_taxonomy_code: dataTaxonomyCode,
              purpose_taxonomy_code: purposeTaxonomyCode,
              destination_country: destinationCountry,
              recipient_entity: recipientEntity,
              transfer_mechanism: transferMechanism,
              legal_basis: legalBasis,
              status,
              condition,
              confidence: destinationCountry === 'KR' ? 0.88 : 0.74,
              evidence: [buildEvidence(clause)],
            });
          });
        });
      });
    }
  });

  return {
    processing_facts: Array.from(processingMap.values()),
    transfer_facts: Array.from(transferMap.values()),
  };
}

function upsertProcessingFact(target: Map<string, ExtractedProcessingFact>, item: ExtractedProcessingFact) {
  const key = [
    item.category,
    item.taxonomy_code,
    item.condition ?? '',
  ].join('|');

  const existing = target.get(key);
  if (!existing) {
    target.set(key, item);
    return;
  }

  existing.confidence = Math.max(existing.confidence, item.confidence);
  existing.evidence = mergeEvidence(existing.evidence, item.evidence);
}

function upsertTransferFact(target: Map<string, ExtractedTransferFact>, item: ExtractedTransferFact) {
  const key = [
    item.data_taxonomy_code ?? '',
    item.purpose_taxonomy_code ?? '',
    item.destination_country,
    item.recipient_entity ?? '',
    item.transfer_mechanism ?? '',
    item.status,
    item.condition ?? '',
  ].join('|');

  const existing = target.get(key);
  if (!existing) {
    target.set(key, item);
    return;
  }

  existing.confidence = Math.max(existing.confidence, item.confidence);
  existing.evidence = mergeEvidence(existing.evidence, item.evidence);
}

function mergeEvidence(left: ExtractedEvidence[], right: ExtractedEvidence[]) {
  const map = new Map<number, ExtractedEvidence>();
  [...left, ...right].forEach((item) => {
    map.set(item.order_index, item);
  });
  return Array.from(map.values()).sort((a, b) => a.order_index - b.order_index);
}

function buildEvidence(clause: ClauseRef): ExtractedEvidence {
  return {
    order_index: clause.order_index,
    excerpt: normalizeWhitespace(clause.body).slice(0, 220),
  };
}

function extractCondition(text: string) {
  const match = text.match(/\b(if|where|required|subject to|with your consent|when necessary)[^.]*\./i);
  return match ? normalizeWhitespace(match[0]) : undefined;
}

function detectCountries(text: string) {
  return COUNTRY_PATTERNS
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(text)))
    .map((entry) => entry.code);
}

function detectTransferMechanism(text: string): TransferMechanism | undefined {
  if (/\bscc\b|standard contractual clause/i.test(text)) return 'scc';
  if (/\badequacy\b/i.test(text)) return 'adequacy';
  if (/\bconsent\b/i.test(text)) return 'consent';
  if (/\bintra-?group\b|group agreement/i.test(text)) return 'intra_group_agreement';
  return 'unknown';
}

function detectLegalBasis(text: string) {
  const match = text.match(/\b(consent|legal obligation|contract|legitimate interests?)\b/i);
  return match ? match[1] : undefined;
}

function detectRecipientEntity(text: string) {
  const match = text.match(/(Hyundai Motor Company|Hyundai Motor Europe GmbH|Hyundai Connected Mobility GmbH|Hyundai Motor America)/i);
  return match ? match[1] : undefined;
}

function determineTransferStatus(text: string, destinations: string[], condition?: string): TransferStatus {
  if (/\b(do not transfer|not transfer|do not share outside)\b/i.test(text)) {
    return 'not_allowed';
  }
  if (condition) {
    return 'conditional';
  }
  if (destinations.length > 0) {
    return 'allowed';
  }
  return 'unclear';
}

async function tryAnthropicExtraction(input: {
  market_entity: string;
  service_family: ServiceFamily;
  clauses: ClauseRef[];
}): Promise<ExtractedTermsFacts | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const taxonomy = loadTermsTaxonomy();
    const controllers = loadTermsControllers();
    const applicability = loadTermsApplicability().filter((entry) => entry.market_entity === input.market_entity);
    const anthropicModule = await import('@anthropic-ai/sdk');
    const Anthropic = anthropicModule.default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_TERMS_MODEL ?? 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: [
        'You are a privacy/terms analyst for Hyundai global.',
        'Return JSON only with processing_facts and transfer_facts arrays.',
        'Use only the provided taxonomy codes.',
        'Only emit facts that are clearly grounded in the clauses.',
        'For transfers: if destination is not explicit, set destination_country to "unknown" and status to "unclear".',
        'For Korea transfers: use status "allowed" only when Korea or Hyundai Motor Company HQ is explicitly named.',
        `Taxonomy: ${JSON.stringify(taxonomy)}`,
        `Controllers: ${JSON.stringify(controllers)}`,
        `Applicability: ${JSON.stringify(applicability)}`,
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            market_entity: input.market_entity,
            service_family: input.service_family,
            clauses: input.clauses,
          }),
        },
      ],
    });

    const text = Array.isArray(response.content)
      ? response.content
        .filter((item: { type?: string }) => item.type === 'text')
        .map((item: { text?: string }) => item.text ?? '')
        .join('\n')
      : '';

    const jsonText = extractJsonPayload(text);
    if (!jsonText) {
      return null;
    }

    const parsed = JSON.parse(jsonText) as Partial<ExtractedTermsFacts>;
    return validateExtractedTermsFacts(parsed, input.clauses);
  } catch {
    return null;
  }
}

function extractJsonPayload(value: string) {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return value.slice(start, end + 1);
}

function validateExtractedTermsFacts(
  value: Partial<ExtractedTermsFacts>,
  clauses: ClauseRef[],
): ExtractedTermsFacts {
  const taxonomy = loadTermsTaxonomy();
  const validDataCodes = new Set(taxonomy.data.map((entry) => entry.code));
  const validPurposeCodes = new Set(taxonomy.purpose.map((entry) => entry.code));
  const clauseOrderIndexes = new Set(clauses.map((clause) => clause.order_index));

  const processing_facts = Array.isArray(value.processing_facts)
    ? value.processing_facts.filter((item): item is ExtractedProcessingFact => {
      if (!item || typeof item !== 'object') return false;
      if (!['collectible_data', 'collection_purpose', 'transfer_purpose'].includes(String(item.category))) return false;
      const code = String(item.taxonomy_code ?? '');
      if (!validDataCodes.has(code) && !validPurposeCodes.has(code)) return false;
      return Array.isArray(item.evidence) && item.evidence.some((entry) => clauseOrderIndexes.has(Number(entry.order_index)));
    }).map((item) => ({
      category: item.category,
      taxonomy_code: item.taxonomy_code,
      condition: typeof item.condition === 'string' ? item.condition : undefined,
      confidence: clampConfidence(item.confidence),
      evidence: sanitizeEvidence(item.evidence, clauseOrderIndexes),
    }))
    : [];

  const transfer_facts = Array.isArray(value.transfer_facts)
    ? value.transfer_facts.filter((item): item is ExtractedTransferFact => {
      if (!item || typeof item !== 'object') return false;
      if (!['allowed', 'not_allowed', 'unclear', 'conditional'].includes(String(item.status))) return false;
      return Array.isArray(item.evidence) && item.evidence.some((entry) => clauseOrderIndexes.has(Number(entry.order_index)));
    }).map((item) => ({
      data_taxonomy_code: validDataCodes.has(String(item.data_taxonomy_code)) ? item.data_taxonomy_code : undefined,
      purpose_taxonomy_code: validPurposeCodes.has(String(item.purpose_taxonomy_code)) ? item.purpose_taxonomy_code : undefined,
      destination_country: typeof item.destination_country === 'string' ? item.destination_country : 'unknown',
      recipient_entity: typeof item.recipient_entity === 'string' ? item.recipient_entity : undefined,
      transfer_mechanism: sanitizeTransferMechanism(item.transfer_mechanism),
      legal_basis: typeof item.legal_basis === 'string' ? item.legal_basis : undefined,
      status: item.status,
      condition: typeof item.condition === 'string' ? item.condition : undefined,
      confidence: clampConfidence(item.confidence),
      evidence: sanitizeEvidence(item.evidence, clauseOrderIndexes),
    }))
    : [];

  return { processing_facts, transfer_facts };
}

function sanitizeEvidence(value: ExtractedEvidence[], clauseOrderIndexes: Set<number>) {
  return value
    .filter((entry) => clauseOrderIndexes.has(Number(entry.order_index)))
    .map((entry) => ({
      order_index: Number(entry.order_index),
      excerpt: typeof entry.excerpt === 'string' ? entry.excerpt : undefined,
    }));
}

function sanitizeTransferMechanism(value: unknown): TransferMechanism | undefined {
  if (value === 'scc' || value === 'adequacy' || value === 'consent' || value === 'intra_group_agreement' || value === 'unknown') {
    return value;
  }
  return undefined;
}

function clampConfidence(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0.7;
  }
  return Math.max(0, Math.min(1, value));
}

export function getProcessingDisplayLabel(category: FactCategory, taxonomyCode: string) {
  if (category === 'collectible_data') {
    return getTermsTaxonomyLabel(taxonomyCode);
  }
  return getTermsTaxonomyLabel(taxonomyCode);
}

export function getReviewStatusLabel(reviewStatus: ReviewStatus) {
  switch (reviewStatus) {
    case 'approved':
      return '승인됨';
    case 're_review_required':
      return '재검토 필요';
    case 'rejected':
      return '반려';
    case 'stale':
      return '최신 문서 기준 아님';
    default:
      return '검토 대기';
  }
}
