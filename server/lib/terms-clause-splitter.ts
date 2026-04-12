import type { TermsClause } from '@/types/terms';
import { extractHtmlBlocks, normalizeTextBlock, normalizeWhitespace, stripHtmlToText } from './terms-text';

export type TermsClauseDraft = Omit<TermsClause, 'id' | 'version_id'>;

export function splitTermsClauses(input: { html?: string | null; text?: string | null; language?: string | null }) {
  if (input.html && input.html.trim()) {
    return splitHtmlClauses(input.html, input.language ?? null);
  }

  return splitTextClauses(input.text ?? '', input.language ?? null);
}

function splitHtmlClauses(html: string, language: string | null) {
  const blocks = extractHtmlBlocks(html);
  const headings: string[] = [];
  const clauses: TermsClauseDraft[] = [];
  let charCursor = 0;

  blocks.forEach((block) => {
    if (block.level) {
      headings[block.level - 1] = block.text;
      headings.length = block.level;
      return;
    }

    const body = normalizeTextBlock(block.text);
    if (body.length < 40) {
      return;
    }

    const heading = headings[headings.length - 1] ?? null;
    const path = headings.filter(Boolean).join(' > ') || null;
    const charStart = charCursor;
    const charEnd = charStart + body.length;

    clauses.push({
      path,
      heading,
      body,
      language,
      order_index: clauses.length + 1,
      char_start: charStart,
      char_end: charEnd,
    });

    charCursor = charEnd + 2;
  });

  if (clauses.length > 0) {
    return clauses;
  }

  const fallback = stripHtmlToText(html);
  if (!fallback) {
    return [];
  }

  return [
    {
      path: null,
      heading: null,
      body: fallback,
      language,
      order_index: 1,
      char_start: 0,
      char_end: fallback.length,
    },
  ];
}

function splitTextClauses(text: string, language: string | null) {
  const normalized = normalizeTextBlock(text);
  if (!normalized) {
    return [];
  }

  const chunks = normalized
    .split(/\n{2,}/)
    .map((chunk) => normalizeTextBlock(chunk))
    .filter(Boolean);

  const clauses: TermsClauseDraft[] = [];
  let activeHeading: string | null = null;
  let charCursor = 0;

  chunks.forEach((chunk) => {
    const lines = chunk.split('\n').map((line) => normalizeWhitespace(line)).filter(Boolean);
    if (lines.length === 0) {
      return;
    }

    const firstLine = lines[0];
    const remaining = normalizeTextBlock(lines.slice(1).join('\n'));
    const firstIsHeading = isHeadingLine(firstLine);

    if (firstIsHeading && !remaining) {
      activeHeading = firstLine;
      return;
    }

    const body = firstIsHeading && remaining.length >= 40
      ? remaining
      : chunk;

    if (firstIsHeading && remaining.length >= 40) {
      activeHeading = firstLine;
    }

    if (body.length < 40) {
      return;
    }

    const charStart = charCursor;
    const charEnd = charStart + body.length;
    clauses.push({
      path: activeHeading,
      heading: activeHeading,
      body,
      language,
      order_index: clauses.length + 1,
      char_start: charStart,
      char_end: charEnd,
    });
    charCursor = charEnd + 2;
  });

  if (clauses.length > 0) {
    return clauses;
  }

  return [
    {
      path: null,
      heading: null,
      body: normalized,
      language,
      order_index: 1,
      char_start: 0,
      char_end: normalized.length,
    },
  ];
}

function isHeadingLine(line: string) {
  if (!line) {
    return false;
  }
  if (/^[0-9]+(\.[0-9]+)*[.)]?\s+/.test(line)) {
    return line.length <= 120;
  }
  if (/^[A-Z0-9 .,&:/()'-]+$/.test(line) && line.length <= 100) {
    return true;
  }
  if (line.endsWith(':') && line.length <= 120) {
    return true;
  }
  return false;
}
