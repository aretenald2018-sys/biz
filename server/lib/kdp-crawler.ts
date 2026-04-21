import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import type { KdpBrand, KdpCategory } from '@/types/kdp';
import { classifyCategory, normalizeWhitespace, slugify, splitIntoChunks } from './kdp-chunker';

export interface ParsedSection {
  order_idx: number;
  parent_idx: number | null;
  heading_level: number;
  heading: string;
  anchor_slug: string;
  path_text: string | null;
  category: KdpCategory;
  text: string;
}

export interface ParsedModal {
  link_key: string;
  label: string;
  title: string | null;
  html: string;
  text: string;
  anchored_section_idx: number | null;
  category: KdpCategory;
}

export interface ParsedChunk {
  section_idx: number | null;
  modal_idx: number | null;
  ord: number;
  text: string;
  category: KdpCategory;
  heading_path: string | null;
}

export interface ParsedPolicy {
  title: string | null;
  plain_text: string;
  version_hash: string;
  sections: ParsedSection[];
  modals: ParsedModal[];
  chunks: ParsedChunk[];
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface FetchResult {
  ok: boolean;
  html?: string;
  status?: number;
  error?: string;
}

export async function fetchPolicyHtml(url: string): Promise<FetchResult> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    if (!resp.ok) {
      return { ok: false, status: resp.status, error: `HTTP ${resp.status}` };
    }
    const html = await resp.text();
    return { ok: true, html, status: resp.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function parseHtmlToPolicy(html: string, _brand: KdpBrand): ParsedPolicy {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim() || null;

  $('script, style, noscript, nav, header, footer').remove();

  const mainCandidates = [
    'main',
    '[role="main"]',
    '#content',
    '.content',
    '.policy',
    '.full-policy',
    '.privacy',
    'article',
  ];
  let $root = $('body');
  for (const sel of mainCandidates) {
    const $candidate = $(sel).first();
    if ($candidate.length && $candidate.text().trim().length > ($root?.text().trim().length ?? 0) / 2) {
      $root = $candidate;
    }
  }

  // 섹션 본문 파싱에서는 숨겨진 모달 본문을 제거해 중복 텍스트 유입을 막는다.
  const $sectionDoc = cheerio.load(`<body>${$root.html() ?? ''}</body>`);
  const $sectionRoot = $sectionDoc('body');
  $sectionRoot.find('.popup-box, .modal, [role="dialog"], [aria-modal="true"]').remove();

  const sections: ParsedSection[] = [];
  const plainPieces: string[] = [];

  const stack: { idx: number; level: number; heading: string }[] = [];
  let currentTextBuf: string[] = [];

  const flushCurrent = () => {
    if (sections.length === 0) return;
    const last = sections[sections.length - 1];
    const body = normalizeWhitespace(currentTextBuf.join('\n').trim());
    last.text = body;
    currentTextBuf = [];
  };

  const allowed = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'LI', 'TABLE', 'DIV', 'UL', 'OL', 'DT', 'DD']);

  const walk = (node: cheerio.AnyNode) => {
    if (node.type !== 'tag') return;
    const el = node as cheerio.Element;
    const tag = el.tagName?.toUpperCase();
    if (!tag) return;
    if (!allowed.has(tag)) {
      el.children?.forEach(walk);
      return;
    }
    if (/^H[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const heading = normalizeWhitespace($sectionDoc(el).text());
      if (!heading) return;
      flushCurrent();
      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const idx = sections.length;
      const parent = stack.length ? stack[stack.length - 1].idx : null;
      const pathHeadings = stack.map((s) => s.heading).concat(heading);
      const section: ParsedSection = {
        order_idx: idx,
        parent_idx: parent,
        heading_level: level,
        heading,
        anchor_slug: slugify(heading, `sec-${idx}`),
        path_text: pathHeadings.join(' > '),
        category: classifyCategory('', heading),
        text: '',
      };
      sections.push(section);
      stack.push({ idx, level, heading });
      return;
    }
    if (tag === 'DIV') {
      el.children?.forEach(walk);
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      const listText = structuredText($sectionDoc, el);
      const normalized = normalizeWhitespace(listText);
      if (normalized) currentTextBuf.push(normalized);
      return;
    }
    if (tag === 'TABLE') {
      const tableText = extractTableText($sectionDoc, el);
      if (tableText) currentTextBuf.push(tableText);
      return;
    }
    const textContent = normalizeWhitespace(structuredText($sectionDoc, el));
    if (textContent) currentTextBuf.push(textContent);
  };

  $sectionRoot.children().each((_i: number, child: cheerio.AnyNode) => walk(child));
  flushCurrent();

  if (sections.length === 0) {
    const fallbackText = normalizeWhitespace($sectionRoot.text());
    if (fallbackText) {
      sections.push({
        order_idx: 0,
        parent_idx: null,
        heading_level: 1,
        heading: title ?? '개인정보처리방침',
        anchor_slug: 'root',
        path_text: title ?? '개인정보처리방침',
        category: 'other',
        text: fallbackText,
      });
    }
  }

  sections.forEach((s) => {
    // 약한(네비성) 섹션 — 목차/알기 쉬운 요약은 링크 리스트라 Q&A·표시에 노이즈가 되므로 본문 비움
    if (isWeakSectionHeading(s.heading)) {
      s.text = '';
      s.category = 'other';
    } else {
      s.category = classifyCategory(s.text, s.heading);
    }
    if (s.heading) plainPieces.push(`\n\n## ${s.heading}`);
    if (s.text) plainPieces.push(s.text);
  });

  const modals = extractModals($, $root, sections);

  const chunks: ParsedChunk[] = [];
  let ord = 0;
  sections.forEach((s, sIdx) => {
    const parts = splitIntoChunks(s.text, 600);
    parts.forEach((chunkText) => {
      chunks.push({
        section_idx: sIdx,
        modal_idx: null,
        ord: ord++,
        text: chunkText,
        category: s.category,
        heading_path: s.path_text,
      });
    });
  });
  modals.forEach((m, mIdx) => {
    const parts = splitIntoChunks(m.text, 600);
    parts.forEach((chunkText) => {
      chunks.push({
        section_idx: null,
        modal_idx: mIdx,
        ord: ord++,
        text: chunkText,
        category: m.category,
        heading_path: `[모달] ${m.label}${m.title ? ' > ' + m.title : ''}`,
      });
    });
  });

  const plainText = normalizeWhitespace(plainPieces.join('\n')) +
    (modals.length
      ? '\n\n' + modals.map((m) => `[모달:${m.label}] ${m.text}`).join('\n\n')
      : '');
  const versionHash = crypto.createHash('sha256').update(plainText).digest('hex');

  return {
    title,
    plain_text: plainText,
    version_hash: versionHash,
    sections,
    modals,
    chunks,
  };
}

function cssIdEscape(id: string): string {
  return id.replace(/["\\]/g, '\\$&');
}

function extractModalTargetId(href: string, dataTarget: string): string {
  const direct = dataTarget.trim().replace(/^#/, '');
  if (direct) return direct;

  const trimmedHref = href.trim();
  if (!trimmedHref) return '';

  const hashIndex = trimmedHref.lastIndexOf('#');
  if (hashIndex < 0 || hashIndex === trimmedHref.length - 1) return '';

  return trimmedHref.slice(hashIndex + 1).trim();
}

function normalizeLookup(value: string): string {
  return normalizeWhitespace(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function isWeakSectionHeading(heading: string): boolean {
  const normalized = normalizeLookup(heading);
  return normalized === normalizeLookup('목차') || normalized.includes(normalizeLookup('알기 쉬운 개인정보처리방침'));
}

function resolveModalSectionIdx(
  sections: ParsedSection[],
  nearestSectionIdx: number | null,
  label: string,
  title: string | null,
  text: string,
  category: KdpCategory,
): number | null {
  if (sections.length === 0) return null;

  const nearest = nearestSectionIdx != null ? sections[nearestSectionIdx] : null;
  if (nearest && !isWeakSectionHeading(nearest.heading)) return nearestSectionIdx;

  const lookupKeys = [label, title ?? '']
    .map((value) => normalizeLookup(value))
    .filter((value) => value.length >= 6);

  const headingHints: Array<{ pattern: RegExp; heading: string }> = [
    { pattern: /처리\s*목적|보유기간/, heading: '처리 목적' },
    { pattern: /처리\s*위탁/, heading: '처리 위탁' },
    { pattern: /제3자\s*제공/, heading: '제3자 제공' },
    { pattern: /국외\s*이전/, heading: '국외 이전' },
    { pattern: /행태정보/, heading: '행태정보' },
    { pattern: /쿠키/, heading: '자동 수집 장치' },
    { pattern: /권리|행사방법/, heading: '권리와 의무' },
    { pattern: /보호책임자|담당자/, heading: '보호책임자' },
  ];

  let bestIdx: number | null = null;
  let bestScore = 0;
  sections.forEach((section, idx) => {
    if (isWeakSectionHeading(section.heading)) return;

    const heading = normalizeLookup(section.heading);
    const haystack = normalizeLookup(`${section.heading}\n${section.text}`);
    let score = 0;

    lookupKeys.forEach((key) => {
      if (heading.includes(key)) score += key.length + 80;
      else if (haystack.includes(key)) score += key.length + 20;
    });

    headingHints.forEach((hint) => {
      if (!hint.pattern.test(`${label} ${title ?? ''} ${text}`)) return;
      if (heading.includes(normalizeLookup(hint.heading))) score += 90;
    });

    if (section.category === category) score += 10;

    if (score > bestScore) {
      bestIdx = idx;
      bestScore = score;
    }
  });

  if (bestIdx != null) return bestIdx;
  return nearestSectionIdx;
}

function extractTableText($: cheerio.CheerioAPI, table: cheerio.Element): string {
  const rows: string[] = [];
  $(table).find('tr').each((_i: number, tr: cheerio.Element) => {
    const cells: string[] = [];
    $(tr).find('th,td').each((_j: number, td: cheerio.Element) => {
      const t = normalizeWhitespace($(td).text());
      if (t) cells.push(t);
    });
    if (cells.length) rows.push(cells.join(' | '));
  });
  return rows.join('\n');
}

/**
 * 블록 수준 구조를 보존하면서 텍스트를 추출한다.
 * <p>/<div>/<li>/<br>/<tr>/<hN> 경계를 줄바꿈으로, <li>는 "- " 접두.
 */
export function structuredText($: cheerio.CheerioAPI, root: cheerio.Element | cheerio.AnyNode): string {
  const lines: string[] = [''];
  const append = (text: string) => {
    if (!text) return;
    if (lines.length === 0) lines.push('');
    lines[lines.length - 1] += text;
  };
  const newline = () => {
    if (lines[lines.length - 1] !== '') lines.push('');
  };
  const paragraphBreak = () => {
    if (lines[lines.length - 1] !== '') lines.push('');
    if (lines[lines.length - 1] !== '' || lines[lines.length - 2] !== '') lines.push('');
  };

  const walk = (node: cheerio.AnyNode) => {
    if (node.type === 'text') {
      const raw = (node as { data?: string }).data ?? '';
      const cleaned = raw.replace(/[\s ]+/g, ' ');
      if (cleaned && cleaned !== ' ') append(cleaned);
      return;
    }
    if (node.type !== 'tag') return;
    const el = node as cheerio.Element;
    const tag = el.tagName?.toUpperCase() ?? '';
    const children = el.children ?? [];
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
    if (tag === 'BR') {
      newline();
      return;
    }
    if (tag === 'TABLE') {
      paragraphBreak();
      const t = extractTableText($, el);
      if (t) {
        t.split('\n').forEach((row) => {
          append(row);
          newline();
        });
      }
      paragraphBreak();
      return;
    }
    if (/^H[1-6]$/.test(tag)) {
      paragraphBreak();
      children.forEach(walk);
      paragraphBreak();
      return;
    }
    if (tag === 'P' || tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE' || tag === 'BLOCKQUOTE' || tag === 'DT' || tag === 'DD') {
      paragraphBreak();
      children.forEach(walk);
      paragraphBreak();
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      paragraphBreak();
      children.forEach(walk);
      paragraphBreak();
      return;
    }
    if (tag === 'LI') {
      newline();
      append('- ');
      children.forEach(walk);
      newline();
      return;
    }
    // inline/default
    children.forEach(walk);
  };

  walk(root);
  return lines.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractModals(
  $: cheerio.CheerioAPI,
  $root: ReturnType<cheerio.CheerioAPI>,
  sections: ParsedSection[],
): ParsedModal[] {
  const modals: ParsedModal[] = [];
  const seen = new Set<string>();

  const triggerSelector = [
    'a.pop-open',
    'a[role="button"]',
    'button[data-modal]',
    'button[aria-controls]',
    'a[data-target]',
    'a[href*="#"]',
  ].join(', ');

  $root.find(triggerSelector).each((_i: number, el: cheerio.Element) => {
    const $el = $(el);
    const label = normalizeWhitespace($el.text());
    if (!label) return;
    const href = $el.attr('href') ?? '';
    const dataTarget = $el.attr('data-target') ?? $el.attr('aria-controls') ?? '';
    const key = href || dataTarget || label;
    if (seen.has(key)) return;

    let html = '';
    let text = '';
    let title: string | null = null;
    let isRealPopupBox = false;
    const id = extractModalTargetId(href, dataTarget);
    if (id) {
      try {
        const $target = $(`[id="${cssIdEscape(id)}"]`);
        if ($target.length) {
          const targetEl = $target[0] as cheerio.Element | undefined;
          const targetTag = targetEl?.tagName?.toUpperCase() ?? '';
          // 타겟이 <h1-h6> 이면 "섹션 앵커" — 가짜 모달. 스킵.
          if (/^H[1-6]$/.test(targetTag)) return;
          const targetClass = ($target.attr('class') ?? '').toLowerCase();
          const hasPopupBox = /\bpopup-box\b/.test(targetClass);
          const hasPopHead = $target.find('.pop-head').length > 0;
          const hasPopCont = $target.find('.pop-cont').length > 0 || $target.find('.pop-scroll').length > 0;
          isRealPopupBox = hasPopupBox || hasPopHead || hasPopCont;
          if (!isRealPopupBox) return;
          title = normalizeWhitespace($target.find('.pop-head .tit').first().text()) || null;
          const bodyEl =
            ($target.find('.pop-cont').first()[0] as cheerio.Element | undefined) ??
            ($target.find('.pop-scroll').first()[0] as cheerio.Element | undefined) ??
            ($target[0] as cheerio.Element | undefined);
          if (bodyEl) {
            html = $(bodyEl).html()?.trim() ?? '';
            text = normalizeWhitespace(structuredText($, bodyEl));
          }
        }
      } catch {
        // invalid selector → skip
      }
    }

    // popup-box가 아니면 아예 모달로 안 잡음 (섹션 스크롤 앵커, data-download 링크 등 제외)
    if (!isRealPopupBox) return;

    // 내용이 없으면 키워드 기반 트리거로만 기록
    const hasContent = text.length > 30;
    const looksLikeTrigger = /자세히|보기|상세|더보기|표|내역|약관|동의|내용|view|detail|modal/i.test(label);
    if (!hasContent && !looksLikeTrigger) return;

    seen.add(key);
    const category = classifyCategory(`${label} ${title ?? ''} ${text}`, title ?? label);
    const nearestSectionIdx = findNearestSection($, $root, el, sections);
    // over-pop* 는 '국외이전 모달' 내부의 중첩 모달 — 제 12조로 우선 앵커
    const isNestedOverseasPopup = /(^|#)over-pop/i.test(key);
    let anchoredSectionIdx: number | null;
    if (isNestedOverseasPopup) {
      const overseasIdx = sections.findIndex((s) => s.category === 'overseas');
      anchoredSectionIdx =
        overseasIdx >= 0
          ? overseasIdx
          : resolveModalSectionIdx(sections, nearestSectionIdx, label, title, text, category);
    } else {
      anchoredSectionIdx = resolveModalSectionIdx(sections, nearestSectionIdx, label, title, text, category);
    }

    modals.push({
      link_key: key,
      label,
      title,
      html,
      text: text || `(모달 "${label}" — 원문 페이지가 SPA라 자동 저장 HTML에 본문이 없습니다. [수동 편집]에서 채워주세요.)`,
      anchored_section_idx: anchoredSectionIdx,
      category,
    });
  });

  return modals;
}

function findNearestSection(
  $: cheerio.CheerioAPI,
  _root: ReturnType<cheerio.CheerioAPI>,
  el: cheerio.Element,
  sections: ParsedSection[],
): number | null {
  if (sections.length === 0) return null;
  let node: cheerio.AnyNode | null = el;
  while (node) {
    if (node.type === 'tag') {
      const tagEl = node as cheerio.Element;
      const tag = tagEl.tagName?.toUpperCase() ?? '';
      if (/^H[1-6]$/.test(tag)) {
        const heading = normalizeWhitespace($(tagEl).text());
        const idx = sections.findIndex((s) => s.heading === heading);
        if (idx >= 0) return idx;
      }
    }
    const prev = (node as { prev?: cheerio.AnyNode }).prev;
    if (prev) {
      node = prev;
      continue;
    }
    node = (node as { parent?: cheerio.AnyNode }).parent ?? null;
  }
  return 0;
}

export function isSuspiciouslyEmpty(parsed: ParsedPolicy): boolean {
  return parsed.plain_text.length < 500 || parsed.sections.length < 2;
}
