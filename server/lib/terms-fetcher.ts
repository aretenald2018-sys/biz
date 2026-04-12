import type { TermsAsset, TermsDocumentVersion } from '@/types/terms';

export interface TermsFetchResult {
  status: number;
  buf?: Buffer;
  mime?: string;
  etag?: string;
  lastModified?: string;
  finalUrl?: string;
  blockedByRobots?: boolean;
}

const ROBOTS_CACHE = new Map<string, { expiresAt: number; allow: (pathname: string) => boolean }>();
const USER_AGENT = 'HMC-TermsMonitor/0.1 (+compliance@hyundai.local)';

export async function fetchConditional(
  asset: TermsAsset,
  previous?: TermsDocumentVersion | null,
  options: { force?: boolean } = {},
): Promise<TermsFetchResult> {
  const url = new URL(asset.url);
  const allow = await getRobotsEvaluator(url);
  if (!allow(url.pathname)) {
    return {
      status: -1,
      blockedByRobots: true,
      finalUrl: asset.url,
    };
  }

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
  };

  if (!options.force) {
    if (previous?.etag) {
      headers['If-None-Match'] = previous.etag;
    }
    if (previous?.last_modified_header) {
      headers['If-Modified-Since'] = previous.last_modified_header;
    }
  }

  const response = await fetch(asset.url, {
    headers,
    redirect: 'follow',
  });

  if (response.status === 304) {
    return {
      status: 304,
      finalUrl: response.url || asset.url,
    };
  }

  return {
    status: response.status,
    buf: Buffer.from(await response.arrayBuffer()),
    mime: response.headers.get('content-type') ?? '',
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
    finalUrl: response.url || asset.url,
  };
}

async function getRobotsEvaluator(url: URL) {
  const origin = url.origin;
  const cached = ROBOTS_CACHE.get(origin);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allow;
  }

  let evaluator = (_pathname: string) => true;

  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/plain,*/*;q=0.1' },
    });

    if (response.ok) {
      evaluator = buildRobotsEvaluator(await response.text());
    }
  } catch {
    evaluator = (_pathname: string) => true;
  }

  ROBOTS_CACHE.set(origin, {
    allow: evaluator,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

  return evaluator;
}

function buildRobotsEvaluator(robotsText: string) {
  const allowRules: string[] = [];
  const disallowRules: string[] = [];
  let applies = false;

  robotsText
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((line) => {
      const normalized = line.split('#')[0]?.trim();
      if (!normalized) {
        return;
      }

      const [rawKey, ...rawValue] = normalized.split(':');
      const key = rawKey.trim().toLowerCase();
      const value = rawValue.join(':').trim();

      if (key === 'user-agent') {
        const agent = value.toLowerCase();
        applies = agent === '*' || agent === USER_AGENT.toLowerCase();
        return;
      }

      if (!applies) {
        return;
      }

      if (key === 'allow' && value) {
        allowRules.push(value);
      }

      if (key === 'disallow' && value) {
        disallowRules.push(value);
      }
    });

  return (pathname: string) => {
    const matchingAllow = longestMatch(pathname, allowRules);
    const matchingDisallow = longestMatch(pathname, disallowRules);
    return matchingAllow.length >= matchingDisallow.length;
  };
}

function longestMatch(pathname: string, rules: string[]) {
  return rules.reduce((best, rule) => {
    if (!rule || !pathname.startsWith(rule)) {
      return best;
    }
    return rule.length > best.length ? rule : best;
  }, '');
}
