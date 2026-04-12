import type { DocumentType, ServiceFamily, TermsAsset } from '@/types/terms';
import { extractAnchorsFromHtml, normalizeWhitespace } from './terms-text';

export interface DiscoveredTermsCandidate {
  source_url: string;
  candidate_url: string;
  anchor_text?: string;
  hint_market_entity?: string;
  hint_service_family?: ServiceFamily;
  hint_document_type?: DocumentType;
}

const CANDIDATE_REGEX =
  /(privacy|terms|legal|cookie|bluelink|connected|connectivity|myhyundai|mykia|digital[- ]?key|pay(ment)?|store|update|navigation|data[- ]?rights|subscription|used|locator|app|click[- ]?to[- ]?buy)/i;

export async function discoverTermsCandidates(
  asset: TermsAsset,
  existingUrls: Set<string>,
  depth = 1,
): Promise<DiscoveredTermsCandidate[]> {
  const visited = new Set<string>();
  const queued = [{ url: asset.url, sourceUrl: asset.url, hop: 0 }];
  const results: DiscoveredTermsCandidate[] = [];
  const baseOrigin = new URL(asset.url).origin;

  while (queued.length > 0) {
    const current = queued.shift();
    if (!current || visited.has(current.url) || current.hop > depth) {
      continue;
    }

    visited.add(current.url);

    let response: Response;
    try {
      response = await fetch(current.url, {
        headers: {
          'User-Agent': 'HMC-TermsMonitor/0.1 (+compliance@hyundai.local)',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        redirect: 'follow',
      });
    } catch {
      continue;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.toLowerCase().includes('html')) {
      continue;
    }

    const html = await response.text();
    const anchors = extractAnchorsFromHtml(html);

    for (const anchor of anchors) {
      const absoluteUrl = toAbsoluteUrl(anchor.href, current.url);
      if (!absoluteUrl) {
        continue;
      }

      let parsed: URL;
      try {
        parsed = new URL(absoluteUrl);
      } catch {
        continue;
      }

      if (parsed.origin !== baseOrigin) {
        continue;
      }

      const candidateUrl = stripHash(parsed.toString());
      const haystack = `${anchor.text} ${candidateUrl}`;
      if (!CANDIDATE_REGEX.test(haystack)) {
        continue;
      }

      if (!existingUrls.has(candidateUrl)) {
        existingUrls.add(candidateUrl);
        results.push({
          source_url: current.sourceUrl,
          candidate_url: candidateUrl,
          anchor_text: anchor.text || undefined,
          hint_market_entity: asset.market_entity,
          hint_service_family: inferServiceFamily(haystack),
          hint_document_type: inferDocumentType(haystack),
        });
      }

      if (current.hop + 1 < depth && !visited.has(candidateUrl)) {
        queued.push({
          url: candidateUrl,
          sourceUrl: current.sourceUrl,
          hop: current.hop + 1,
        });
      }
    }
  }

  return results;
}

function stripHash(url: string) {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.toString();
}

function toAbsoluteUrl(href: string, baseUrl: string) {
  try {
    const absolute = new URL(href, baseUrl);
    return absolute.toString();
  } catch {
    return null;
  }
}

function inferServiceFamily(value: string): ServiceFamily | undefined {
  const haystack = normalizeWhitespace(value).toLowerCase();
  if (haystack.includes('used') && haystack.includes('locator')) return 'used_vehicle_locator';
  if (haystack.includes('service app') || haystack.includes('mykia') || haystack.includes('connectivity')) {
    return 'service_app';
  }
  if (haystack.includes('bluelink store') || haystack.includes('/store') || haystack.includes('hyundai pay')) {
    return 'store_payment';
  }
  if (haystack.includes('payment') || haystack.includes('pay ')) return 'store_payment';
  if (
    haystack.includes('bluelink') ||
    haystack.includes('connected mobility') ||
    haystack.includes('connected service') ||
    haystack.includes('kia connect') ||
    haystack.includes('digital key')
  ) {
    return 'connected_services';
  }
  if (haystack.includes('update') || haystack.includes('navigation')) return 'navigation_update';
  if (haystack.includes('myhyundai') || haystack.includes('owner') || haystack.includes('portal') || haystack.includes('account')) {
    return 'account_portal';
  }
  if (haystack.includes('technology') || haystack.includes('vehicle')) {
    return 'vehicle_tech';
  }
  if (haystack.includes('privacy') || haystack.includes('legal') || haystack.includes('cookie')) {
    return 'website';
  }
  return undefined;
}

function inferDocumentType(value: string): DocumentType | undefined {
  const haystack = normalizeWhitespace(value).toLowerCase();
  if (haystack.includes('cookie')) return 'cookie_notice';
  if (haystack.includes('data right')) return 'data_rights';
  if (haystack.includes('collection')) return 'collection_notice';
  if (haystack.includes('privacy notice')) return 'privacy_notice';
  if (haystack.includes('privacy policy') || haystack.includes('privacy')) return 'privacy_policy';
  if (haystack.includes('term') || haystack.includes('condition')) return 'terms_of_use';
  if (haystack.includes('legal')) return 'legal_disclaimer';
  return undefined;
}
