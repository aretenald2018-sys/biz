import * as cheerio from 'cheerio';
import mammoth from 'mammoth';

export type TermsTextSourceKind = 'html' | 'pdf' | 'docx' | 'text';

export interface TermsTextExtraction {
  kind: TermsTextSourceKind;
  raw_text: string;
  normalized_text: string;
  html?: string;
}

export interface TermsHtmlBlock {
  tag: string;
  level: number | null;
  text: string;
}

export interface TermsHtmlAnchor {
  href: string;
  text: string;
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeTextBlock(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const NOISE_SELECTOR = 'script,style,noscript,svg,canvas,iframe,nav,footer,.cookie-banner,[aria-hidden="true"]';

function loadCleanedHtml(html: string) {
  const $ = cheerio.load(html);
  $(NOISE_SELECTOR).remove();
  return $;
}

function pickContentRoot($: cheerio.CheerioAPI) {
  const candidates = ['main', 'article', '#content'];
  for (const selector of candidates) {
    const node = $(selector).first();
    if (node.length > 0) {
      return node;
    }
  }
  return $('body').first().length > 0 ? $('body').first() : $.root();
}

export function stripHtmlToText(html: string) {
  const $ = loadCleanedHtml(html);
  const root = pickContentRoot($);
  const text = root.text().replace(/\u00a0/g, ' ');
  return normalizeTextBlock(text);
}

export function extractHtmlBlocks(html: string): TermsHtmlBlock[] {
  const $ = loadCleanedHtml(html);
  const root = pickContentRoot($);
  const blocks: TermsHtmlBlock[] = [];

  root.find('h1,h2,h3,h4,h5,h6,p,li,td,blockquote').each((_, el) => {
    const tag = ((el as { tagName?: string }).tagName ?? '').toLowerCase();
    if (!tag) {
      return;
    }
    const text = normalizeTextBlock($(el).text().replace(/\u00a0/g, ' '));
    if (!text) {
      return;
    }
    blocks.push({
      tag,
      level: tag.startsWith('h') ? Number.parseInt(tag.slice(1), 10) : null,
      text,
    });
  });

  return blocks;
}

export function extractAnchorsFromHtml(html: string): TermsHtmlAnchor[] {
  const $ = loadCleanedHtml(html);
  const anchors: TermsHtmlAnchor[] = [];

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    if (!href) {
      return;
    }
    const text = normalizeWhitespace($(el).text().replace(/\u00a0/g, ' '));
    anchors.push({ href, text });
  });

  return anchors;
}

function inferKind(fileName: string, mimeType: string | null | undefined, buffer: Buffer): TermsTextSourceKind {
  const lowerName = fileName.toLowerCase();
  const lowerMime = (mimeType ?? '').toLowerCase();
  if (lowerName.endsWith('.docx') || lowerMime.includes('wordprocessingml')) {
    return 'docx';
  }
  if (lowerName.endsWith('.pdf') || lowerMime.includes('pdf')) {
    return 'pdf';
  }
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerMime.includes('text/html')) {
    return 'html';
  }
  const sample = buffer.toString('utf8', 0, Math.min(buffer.length, 256)).trim().toLowerCase();
  if (sample.startsWith('<!doctype html') || sample.startsWith('<html') || sample.startsWith('<body')) {
    return 'html';
  }
  return 'text';
}

export async function extractPdfText(buffer: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const loadingTask = pdfjs.getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter((value) => value.length > 0);
    pageTexts.push(items.join(' '));
  }

  await doc.cleanup();
  await doc.destroy();

  return normalizeTextBlock(pageTexts.join('\n\n'));
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null,
): Promise<TermsTextExtraction> {
  const kind = inferKind(fileName, mimeType, buffer);

  if (kind === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    const rawText = normalizeTextBlock(result.value ?? '');
    return {
      kind,
      raw_text: rawText,
      normalized_text: normalizeWhitespace(rawText),
    };
  }

  if (kind === 'pdf') {
    const rawText = await extractPdfText(buffer);
    return {
      kind,
      raw_text: rawText,
      normalized_text: normalizeWhitespace(rawText),
    };
  }

  if (kind === 'html') {
    const html = buffer.toString('utf8');
    const rawText = stripHtmlToText(html);
    return {
      kind,
      raw_text: rawText,
      normalized_text: normalizeWhitespace(rawText),
      html,
    };
  }

  const rawText = normalizeTextBlock(buffer.toString('utf8'));
  return {
    kind,
    raw_text: rawText,
    normalized_text: normalizeWhitespace(rawText),
  };
}
