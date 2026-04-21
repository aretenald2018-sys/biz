import type { KdpCategory } from '@/types/kdp';

const CATEGORY_KEYWORDS: Array<{ category: KdpCategory; keywords: string[]; headingWeight?: number }> = [
  // 더 구체적인 카테고리를 위에 둔다 (제3자/국외/처리위탁 > 보유/수집)
  { category: 'third_party', keywords: ['제3자 제공', '제3자제공', '제공받는 자', '제공목적', '제3자에게 제공'] },
  { category: 'overseas', keywords: ['국외 이전', '국외이전', '국외 제공', '해외 이전', '국경 간 이전', '국외로 이전'] },
  { category: 'entrust', keywords: ['처리위탁', '처리 위탁', '수탁', '위탁업체', '수탁업체', '위탁받는 자'] },
  { category: 'cookie', keywords: ['쿠키', 'cookie', '웹 비콘', '자동 수집', '자동수집', 'tracking'] },
  { category: 'auto_decision', keywords: ['자동화된 결정', '자동화 의사결정', '자동화된 의사결정', '프로파일링'] },
  { category: 'dpo', keywords: ['개인정보 보호책임자', '보호책임자', 'dpo', '담당부서'] },
  { category: 'security', keywords: ['안전성 확보', '기술적·관리적', '기술적 관리적', '암호화', '접근통제', '접근 통제'] },
  { category: 'rights', keywords: ['정보주체', '열람', '정정', '삭제', '처리정지', '권리 행사', '정보주체의 권리'] },
  { category: 'collection_item', keywords: ['수집항목', '수집 항목', '수집하는 개인정보', '수집·이용', '개인정보의 수집', '수집하는 항목'] },
  { category: 'retention', keywords: ['보유기간', '보유 기간', '보유 및 이용', '보유·이용', '보유 및 이용기간', '이용 기간', '이용기간', '파기', '보존기간', '보관기간', '보유·파기'] },
];

export function classifyCategory(text: string, heading?: string | null): KdpCategory {
  const headingLower = (heading ?? '').toLowerCase();
  const textLower = text.toLowerCase();
  let best: { category: KdpCategory; score: number } = { category: 'other', score: 0 };
  for (const rule of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const kw of rule.keywords) {
      const lower = kw.toLowerCase();
      if (headingLower.includes(lower)) score += 10;
      if (textLower.includes(lower)) score += 1;
    }
    if (score > best.score) best = { category: rule.category, score };
  }
  return best.category;
}

export function splitIntoChunks(text: string, maxLen = 600): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      chunks.push(para);
      continue;
    }
    const sentences = para.split(/(?<=[.!?。？！])\s+|(?<=다\.)\s+|(?<=요\.)\s+/);
    let buf = '';
    for (const sent of sentences) {
      if (!sent) continue;
      if (buf.length + sent.length + 1 > maxLen && buf) {
        chunks.push(buf.trim());
        buf = sent;
      } else {
        buf = buf ? `${buf} ${sent}` : sent;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  }
  return chunks;
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function slugify(heading: string, fallback: string): string {
  const slug = heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 64);
  return slug || fallback;
}

export function extractKeywords(question: string): string[] {
  const raw = question.toLowerCase();
  const tokens = raw.split(/[\s,.;:()/?!\[\]{}<>"'·、]+/).filter(Boolean);
  const stop = new Set([
    '무엇', '어떤', '어떻게', '언제', '왜', '누구', '어디', '몇',
    '알려줘', '알려주세요', '설명', '설명해', '해줘', '해주세요', '이', '가', '은', '는', '을', '를',
    '이랑', '랑', '과', '와', '도', '의', '에', '에서', '로', '으로', '에게', '부터', '까지',
    '나요', '까요', '입니까', '있나요', '어떻게되나요', '있습니까',
    'what', 'how', 'where', 'when', 'who', 'why', 'the', 'a', 'an', 'is', 'are', 'do',
  ]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    if (tok.length < 2) continue;
    if (stop.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  for (const pair of [
    ['보유', 'retention'], ['보관', 'retention'], ['보존', 'retention'],
    ['제3자', 'third_party'], ['제공', 'third_party'],
    ['국외', 'overseas'], ['해외', 'overseas'],
    ['위탁', 'entrust'], ['수탁', 'entrust'],
    ['쿠키', 'cookie'], ['자동화', 'auto_decision'],
    ['열람', 'rights'], ['삭제', 'rights'], ['정정', 'rights'],
    ['암호화', 'security'], ['안전성', 'security'],
    ['책임자', 'dpo'], ['담당자', 'dpo'],
  ] as const) {
    if (raw.includes(pair[0])) {
      const kw = pair[1];
      if (!seen.has(kw)) {
        seen.add(kw);
        out.push(kw);
      }
    }
  }
  return out.slice(0, 12);
}
