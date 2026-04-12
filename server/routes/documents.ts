import Docxtemplater from 'docxtemplater';
import DiffMatchPatch from 'diff-match-patch';
import { Hono } from 'hono';
import mammoth from 'mammoth';
import PizZip from 'pizzip';
import { getDb } from '@/lib/db';
import { extractTextForDiff } from '../lib/text-extract';
import type {
  DocxAnchorInsert,
  DocxAnchorStatus,
  DocxDiffLine,
  DocxDiffResult,
  DocxDiffSegment,
  DocxPlaceholderEntry,
  DocxTemplateDetail,
  DocxTemplateSummary,
  DocxTemplateUpdateInput,
} from '@/types/document';

const documentRoutes = new Hono();
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const TOKEN_REGEX = /\{\{([^}]+)\}\}/g;
const FULLWIDTH_TOKEN_REGEX = /｛｛([^｝]+)｝｝/g;
const ANGLE_TOKEN_ENTITY_REGEX = /&lt;([가-힣A-Za-z0-9_][가-힣A-Za-z0-9_ ]{0,39})&gt;/g;
const WORD_DOCUMENT_PATH = 'word/document.xml';
const WORD_XML_FILES = /^word\/(?:document|header\d+|footer\d+)\.xml$/;

type DocxTemplateRow = {
  id: string;
  filename: string;
  display_name: string | null;
  file_blob: Buffer;
  preview_html: string | null;
  placeholders_json: string | null;
  tiptap_html: string | null;
  anchor_inserts_json: string | null;
  created_at: string;
  updated_at: string;
};

type DocxDiffUploadRow = {
  id: string;
  filename: string;
  file_blob: Buffer;
  file_type: string | null;
  overridden_text: string | null;
  created_at: string;
};

documentRoutes.get('/api/documents/templates', (c) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, filename, display_name, updated_at
    FROM docx_templates
    ORDER BY updated_at DESC
  `).all() as DocxTemplateSummary[];

  return c.json(rows);
});

documentRoutes.get('/api/documents/templates/:id', (c) => {
  const row = getTemplateRow(c.req.param('id'));

  if (!row) {
    return c.json({ error: '해당 양식을 찾을 수 없습니다.' }, 404);
  }

  return c.json(mapTemplateDetail(row));
});

documentRoutes.post('/api/documents/templates', async (c) => {
  const db = getDb();
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return c.json({ error: '워드 파일(.docx)을 선택해주세요.' }, 400);
  }

  try {
    validateDocxFile(file);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : '파일을 인식할 수 없습니다.' }, 400);
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const fileBuffer = normalizeDocxPlaceholders(rawBuffer);
  const previewResult = await mammoth.convertToHtml({ buffer: fileBuffer });
  const originalPlaceholders = extractOriginalPlaceholders(fileBuffer);
  const displayName = coerceDisplayName(formData.get('display_name'), file.name);

  const result = db.prepare(`
    INSERT INTO docx_templates (
      filename,
      display_name,
      file_blob,
      preview_html,
      placeholders_json,
      tiptap_html,
      anchor_inserts_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    file.name,
    displayName,
    fileBuffer,
    previewResult.value,
    JSON.stringify(originalPlaceholders),
    null,
    JSON.stringify([]),
  );

  const row = db.prepare('SELECT * FROM docx_templates WHERE rowid = ?').get(result.lastInsertRowid) as DocxTemplateRow | undefined;

  return c.json(mapTemplateDetail(assertRow(row, 'Template not found after insert.')), 201);
});

documentRoutes.put('/api/documents/templates/:id', async (c) => {
  const db = getDb();
  const id = c.req.param('id');
  const row = getTemplateRow(id);

  if (!row) {
    return c.json({ error: '해당 양식을 찾을 수 없습니다.' }, 404);
  }

  const body = await c.req.json<DocxTemplateUpdateInput>();
  const anchorInserts = Array.isArray(body.anchor_inserts)
    ? sanitizeAnchorInserts(body.anchor_inserts)
    : parseJson<DocxAnchorInsert[]>(row.anchor_inserts_json, []);
  const originalPlaceholders = parseJson<DocxPlaceholderEntry[]>(row.placeholders_json, []).filter(
    (item) => item.source === 'original',
  );
  const nextDisplayName = body.display_name === undefined
    ? row.display_name
    : coerceDisplayName(body.display_name, row.filename);
  const nextTiptapHtml = body.tiptap_html === undefined ? row.tiptap_html : body.tiptap_html;
  const mergedPlaceholders = mergePlaceholders(originalPlaceholders, anchorInserts);

  db.prepare(`
    UPDATE docx_templates
    SET display_name = ?,
        tiptap_html = ?,
        anchor_inserts_json = ?,
        placeholders_json = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    nextDisplayName,
    nextTiptapHtml,
    JSON.stringify(anchorInserts),
    JSON.stringify(mergedPlaceholders),
    id,
  );

  return c.json(mapTemplateDetail(assertRow(getTemplateRow(id), 'Template not found after update.')));
});

documentRoutes.delete('/api/documents/templates/:id', (c) => {
  const db = getDb();
  db.prepare('DELETE FROM docx_templates WHERE id = ?').run(c.req.param('id'));
  return c.json({ ok: true });
});

documentRoutes.post('/api/documents/templates/:id/convert', async (c) => {
  const row = getTemplateRow(c.req.param('id'));

  if (!row) {
    return c.json({ error: '해당 양식을 찾을 수 없습니다.' }, 404);
  }

  try {
    const body = await c.req.json<{ values?: Record<string, unknown>; companyName?: unknown }>();
    const anchorInserts = parseJson<DocxAnchorInsert[]>(row.anchor_inserts_json, []);
    const { buffer: preparedBuffer, anchorResults } = applyAnchorInsertions(row.file_blob, anchorInserts);
    const zip = new PizZip(preparedBuffer);
    const values = Object.fromEntries(
      Object.entries(body.values ?? {}).map(([key, value]) => [key, value == null ? '' : String(value)]),
    );
    const doc = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      linebreaks: true,
      paragraphLoop: true,
      nullGetter: () => '',
    });
    doc.render(values);

    const companyName = typeof body.companyName === 'string' && body.companyName.trim()
      ? body.companyName.trim()
      : 'output';
    const baseName = sanitizeFileStem(row.display_name || extractFileStem(row.filename));
    const downloadName = `${baseName}_${sanitizeFileStem(companyName)}.docx`;
    const output = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new Response(output, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': buildContentDisposition(downloadName),
        'X-Docx-Anchor-Results': encodeURIComponent(JSON.stringify(anchorResults)),
        'Access-Control-Expose-Headers': 'Content-Disposition, X-Docx-Anchor-Results',
      },
    });
  } catch (error) {
    return c.json({ error: formatDocxRenderError(error) }, 400);
  }
});

documentRoutes.post('/api/documents/diff/upload', async (c) => {
  const db = getDb();
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return c.json({ error: '워드(.docx) 또는 PDF 파일을 선택해주세요.' }, 400);
  }

  try {
    validateDiffFile(file);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : '파일을 인식할 수 없습니다.' }, 400);
  }

  const fileType = resolveDiffFileType(file);

  const result = db.prepare(`
    INSERT INTO docx_diff_uploads (filename, file_blob, file_type)
    VALUES (?, ?, ?)
  `).run(file.name, Buffer.from(await file.arrayBuffer()), fileType);

  const row = db.prepare('SELECT * FROM docx_diff_uploads WHERE rowid = ?').get(result.lastInsertRowid) as DocxDiffUploadRow | undefined;

  return c.json(mapDiffUpload(assertRow(row, '저장 후 파일을 찾지 못했습니다.')), 201);
});

documentRoutes.get('/api/documents/diff/:id/raw', (c) => {
  const row = getDiffUploadRow(c.req.param('id'));

  if (!row) {
    return c.json({ error: '업로드된 파일을 찾을 수 없습니다.' }, 404);
  }

  const contentType = row.file_type
    || (row.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

  return new Response(new Uint8Array(row.file_blob), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': buildContentDisposition(row.filename),
      'Access-Control-Expose-Headers': 'Content-Disposition',
    },
  });
});

documentRoutes.get('/api/documents/diff/:id/preview', async (c) => {
  const row = getDiffUploadRow(c.req.param('id'));

  if (!row) {
    return c.json({ error: '업로드된 파일을 찾을 수 없습니다.' }, 404);
  }

  const kind = inferDiffPreviewKind(row.filename, row.file_type);

  if (kind === 'pdf') {
    return c.json({ kind: 'pdf' as const });
  }

  try {
    const result = await mammoth.convertToHtml({ buffer: row.file_blob });
    return c.json({
      kind: 'docx' as const,
      html: result.value ?? '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '문서 미리보기를 준비하지 못했습니다.';
    return c.json({ error: message }, 400);
  }
});

documentRoutes.patch('/api/documents/diff/:id', async (c) => {
  const db = getDb();
  const id = c.req.param('id');
  const row = db.prepare('SELECT * FROM docx_diff_uploads WHERE id = ?').get(id) as DocxDiffUploadRow | undefined;

  if (!row) {
    return c.json({ error: '업로드된 파일을 찾을 수 없습니다.' }, 404);
  }

  const body = await c.req.json<{ overridden_text?: string | null }>();
  const nextOverride = typeof body.overridden_text === 'string'
    ? body.overridden_text
    : body.overridden_text === null
      ? null
      : row.overridden_text;

  db.prepare('UPDATE docx_diff_uploads SET overridden_text = ? WHERE id = ?').run(nextOverride, id);
  const updated = db.prepare('SELECT * FROM docx_diff_uploads WHERE id = ?').get(id) as DocxDiffUploadRow | undefined;
  return c.json(mapDiffUpload(assertRow(updated, '업데이트 후 파일을 찾지 못했습니다.')));
});

documentRoutes.post('/api/documents/diff/run', async (c) => {
  const body = await c.req.json<{ leftId?: string; rightId?: string }>();

  if (!body.leftId || !body.rightId) {
    return c.json({ error: '비교할 두 파일이 모두 필요합니다.' }, 400);
  }

  const db = getDb();
  const left = db.prepare('SELECT * FROM docx_diff_uploads WHERE id = ?').get(body.leftId) as DocxDiffUploadRow | undefined;
  const right = db.prepare('SELECT * FROM docx_diff_uploads WHERE id = ?').get(body.rightId) as DocxDiffUploadRow | undefined;

  if (!left || !right) {
    return c.json({ error: '비교할 파일을 찾을 수 없습니다. 다시 올려주세요.' }, 404);
  }

  try {
    const [leftExtraction, rightExtraction] = await Promise.all([
      extractTextForDiff(left.file_blob, left.filename, left.file_type, { overrideText: left.overridden_text }),
      extractTextForDiff(right.file_blob, right.filename, right.file_type, { overrideText: right.overridden_text }),
    ]);

    const diff = buildDiffResult(left.filename, right.filename, leftExtraction.text, rightExtraction.text);
    diff.sources = { left: leftExtraction.source, right: rightExtraction.source };
    diff.warnings = [...leftExtraction.warnings, ...rightExtraction.warnings];
    return c.json(diff);
  } catch (error) {
    const message = error instanceof Error ? error.message : '비교 중 오류가 발생했습니다.';
    return c.json({ error: message }, 400);
  }
});

documentRoutes.delete('/api/documents/diff/:id', (c) => {
  const db = getDb();
  db.prepare('DELETE FROM docx_diff_uploads WHERE id = ?').run(c.req.param('id'));
  return c.json({ ok: true });
});

export default documentRoutes;

function getTemplateRow(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM docx_templates WHERE id = ?').get(id) as DocxTemplateRow | undefined;
}

function getDiffUploadRow(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM docx_diff_uploads WHERE id = ?').get(id) as DocxDiffUploadRow | undefined;
}

function mapTemplateDetail(row: DocxTemplateRow): DocxTemplateDetail {
  return {
    id: row.id,
    filename: row.filename,
    display_name: row.display_name,
    updated_at: row.updated_at,
    created_at: row.created_at,
    preview_html: row.preview_html || '',
    tiptap_html: row.tiptap_html,
    placeholders: parseJson<DocxPlaceholderEntry[]>(row.placeholders_json, []),
    anchor_inserts: parseJson<DocxAnchorInsert[]>(row.anchor_inserts_json, []),
  };
}

function mapDiffUpload(row: DocxDiffUploadRow) {
  return {
    id: row.id,
    filename: row.filename,
    file_type: row.file_type,
    has_override: Boolean(row.overridden_text && row.overridden_text.trim().length > 0),
    created_at: row.created_at,
  };
}

function validateDocxFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('워드 파일(.docx)만 올릴 수 있어요.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('파일이 너무 큽니다. 20MB 이하로 올려주세요.');
  }
}

function validateDiffFile(file: File) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.docx') && !lower.endsWith('.pdf')) {
    throw new Error('워드(.docx) 또는 PDF(.pdf) 파일만 올릴 수 있어요.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('파일이 너무 큽니다. 20MB 이하로 올려주세요.');
  }
}

function resolveDiffFileType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

function inferDiffPreviewKind(filename: string, mimeType: string | null): 'docx' | 'pdf' {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    return 'pdf';
  }

  return 'docx';
}

function coerceDisplayName(value: unknown, fallbackFilename: string) {
  if (typeof value !== 'string') {
    return extractFileStem(fallbackFilename);
  }

  const trimmed = value.trim();
  return trimmed || extractFileStem(fallbackFilename);
}

function extractFileStem(filename: string) {
  return filename.replace(/\.docx$/i, '');
}

function sanitizeFileStem(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'document';
}

function buildContentDisposition(fileName: string) {
  const safeAscii = fileName.replace(/[^\x20-\x7e]+/g, '_');
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function sanitizeAnchorInserts(anchorInserts: DocxAnchorInsert[]) {
  return anchorInserts
    .map((item) => ({
      key: String(item.key || '').trim(),
      beforeText: String(item.beforeText || ''),
      afterText: String(item.afterText || ''),
    }))
    .filter((item) => item.key);
}

function mergePlaceholders(
  originalPlaceholders: DocxPlaceholderEntry[],
  anchorInserts: DocxAnchorInsert[],
): DocxPlaceholderEntry[] {
  return [...originalPlaceholders, ...aggregateAnchorPlaceholders(anchorInserts)];
}

function aggregateAnchorPlaceholders(anchorInserts: DocxAnchorInsert[]): DocxPlaceholderEntry[] {
  const counts = new Map<string, number>();

  anchorInserts.forEach((item) => {
    counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
  });

  return Array.from(counts.entries()).map(([key, occurrences]) => ({
    key,
    occurrences,
    source: 'anchor' as const,
  }));
}

function normalizePlaceholderBrackets(xmlText: string): string {
  return xmlText
    .replace(FULLWIDTH_TOKEN_REGEX, (_match, inner: string) => `{{${inner}}}`)
    .replace(ANGLE_TOKEN_ENTITY_REGEX, (_match, inner: string) => `{{${inner}}}`);
}

function unifyFontsInPlaceholderRuns(xmlText: string): string {
  return xmlText.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (runXml) => {
    if (!/\{\{|\}\}/.test(runXml)) {
      return runXml;
    }

    return runXml.replace(/<w:rFonts\b([^>]*?)(\/?)>/g, (fontsTag, rawAttrs: string, slash: string) => {
      const eastAsiaMatch = /\bw:eastAsia="([^"]+)"/.exec(rawAttrs);
      if (!eastAsiaMatch) {
        return fontsTag;
      }

      const eastAsia = eastAsiaMatch[1];
      let attrs = rawAttrs;

      if (/\bw:ascii="[^"]*"/.test(attrs)) {
        attrs = attrs.replace(/\bw:ascii="[^"]*"/, `w:ascii="${eastAsia}"`);
      } else {
        attrs = ` w:ascii="${eastAsia}"${attrs}`;
      }

      if (/\bw:hAnsi="[^"]*"/.test(attrs)) {
        attrs = attrs.replace(/\bw:hAnsi="[^"]*"/, `w:hAnsi="${eastAsia}"`);
      } else {
        attrs = ` w:hAnsi="${eastAsia}"${attrs}`;
      }

      if (/\bw:asciiTheme="[^"]*"/.test(attrs)) {
        attrs = attrs.replace(/\s*\bw:asciiTheme="[^"]*"/, '');
      }
      if (/\bw:hAnsiTheme="[^"]*"/.test(attrs)) {
        attrs = attrs.replace(/\s*\bw:hAnsiTheme="[^"]*"/, '');
      }

      return `<w:rFonts${attrs}${slash}>`;
    });
  });
}

function normalizeDocxPlaceholders(fileBuffer: Buffer): Buffer {
  const zip = new PizZip(fileBuffer);
  let changed = false;

  zip.file(WORD_XML_FILES).forEach((entry) => {
    const original = entry.asText();
    const bracketsNormalized = normalizePlaceholderBrackets(original);
    const fontsUnified = unifyFontsInPlaceholderRuns(bracketsNormalized);
    if (fontsUnified !== original) {
      zip.file(entry.name, fontsUnified);
      changed = true;
    }
  });

  return changed ? zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) : fileBuffer;
}

function extractOriginalPlaceholders(fileBuffer: Buffer): DocxPlaceholderEntry[] {
  const zip = new PizZip(fileBuffer);
  const counts = new Map<string, number>();

  zip.file(WORD_XML_FILES).forEach((entry) => {
    const plainText = extractPlainTextFromWordXml(entry.asText());

    for (const match of plainText.matchAll(TOKEN_REGEX)) {
      const key = match[1]?.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });

  return Array.from(counts.entries()).map(([key, occurrences]) => ({
    key,
    occurrences,
    source: 'original' as const,
  }));
}

function applyAnchorInsertions(fileBuffer: Buffer, anchorInserts: DocxAnchorInsert[]) {
  const zip = new PizZip(fileBuffer);
  const documentFile = zip.file(WORD_DOCUMENT_PATH);

  if (!documentFile) {
    throw new Error('워드 파일에서 본문(document.xml)을 찾지 못했습니다.');
  }

  let xml = documentFile.asText();
  const results: DocxAnchorStatus[] = [];

  anchorInserts.forEach((anchor) => {
    const attempt = insertPlaceholderIntoXml(xml, anchor);
    xml = attempt.xml;
    results.push(attempt.status);
  });

  zip.file(WORD_DOCUMENT_PATH, xml);

  return {
    buffer: zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }),
    anchorResults: results,
  };
}

function insertPlaceholderIntoXml(xml: string, anchor: DocxAnchorInsert) {
  const placeholderText = `{{${anchor.key}}}`;
  const segments = parseWordTextSegments(xml);
  const normalized = normalizeText(segments.plainText);
  const matches = findAnchorCandidates(normalized.text, anchor.beforeText, anchor.afterText);

  if (matches.length === 0) {
    return {
      xml,
      status: buildAnchorStatus(anchor, 'failed', 0, '원본 문서에서 같은 위치를 찾지 못했어요.'),
    };
  }

  const firstMatch = matches[0];
  const rawStart = normalizedIndexToRawIndex(normalized, firstMatch.start, segments.plainText.length);
  const rawEnd = normalizedIndexToRawIndex(normalized, firstMatch.end, segments.plainText.length);

  if (rawStart == null || rawEnd == null) {
    return {
      xml,
      status: buildAnchorStatus(anchor, 'failed', 0, '본문에서 정확한 위치를 결정하지 못했어요.'),
    };
  }

  const nextXml = replaceTextRangeInWordXml(xml, segments, rawStart, rawEnd, placeholderText);
  const statusType = matches.length > 1 ? 'conflict' : 'ready';
  const message = matches.length > 1
    ? '같은 자리가 여러 곳에 있어 첫 번째 위치에 채웠어요.'
    : '바로 채울 수 있어요.';

  return {
    xml: nextXml,
    status: buildAnchorStatus(anchor, statusType, matches.length, message),
  };
}

function buildAnchorStatus(
  anchor: DocxAnchorInsert,
  status: DocxAnchorStatus['status'],
  matches: number,
  message: string,
): DocxAnchorStatus {
  return {
    key: anchor.key,
    beforeText: anchor.beforeText,
    afterText: anchor.afterText,
    status,
    matches,
    message,
  };
}

function parseWordTextSegments(xml: string) {
  const pattern = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
  const segments: Array<{
    xmlStart: number;
    xmlEnd: number;
    openTag: string;
    closeTag: string;
    text: string;
    textStart: number;
    textEnd: number;
  }> = [];
  let plainText = '';
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const openTag = `<w:t${match[1]}>`;
    const decodedText = decodeXml(match[2]);
    const textStart = plainText.length;
    plainText += decodedText;

    segments.push({
      xmlStart: match.index,
      xmlEnd: pattern.lastIndex,
      openTag,
      closeTag: '</w:t>',
      text: decodedText,
      textStart,
      textEnd: plainText.length,
    });
  }

  return { segments, plainText };
}

function extractPlainTextFromWordXml(xml: string) {
  return parseWordTextSegments(xml).plainText;
}

function normalizeText(text: string) {
  let normalized = '';
  const rawIndices: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (/\s/.test(char)) {
      continue;
    }

    normalized += char;
    rawIndices.push(index);
  }

  return { text: normalized, rawIndices };
}

function normalizedIndexToRawIndex(
  normalized: ReturnType<typeof normalizeText>,
  normalizedIndex: number,
  fallbackLength: number,
) {
  if (normalizedIndex <= 0) {
    return 0;
  }

  if (normalizedIndex >= normalized.rawIndices.length) {
    return fallbackLength;
  }

  return normalized.rawIndices[normalizedIndex];
}

function findAllOccurrences(text: string, search: string) {
  if (!search) {
    return [];
  }

  const indices: number[] = [];
  let start = 0;

  while (start <= text.length) {
    const next = text.indexOf(search, start);
    if (next === -1) break;
    indices.push(next);
    start = next + 1;
  }

  return indices;
}

function findAnchorCandidates(text: string, beforeText: string, afterText: string) {
  if (beforeText && afterText) {
    const exactMatches = findAllOccurrences(text, `${beforeText}${afterText}`).map((index) => ({
      start: index + beforeText.length,
      end: index + beforeText.length,
    }));

    if (exactMatches.length > 0) {
      return exactMatches;
    }

    const unique = new Map<string, { start: number; end: number }>();

    findAllOccurrences(text, beforeText).forEach((beforeIndex) => {
      const afterIndex = text.indexOf(afterText, beforeIndex + beforeText.length);

      if (afterIndex === -1) {
        return;
      }

      const gap = afterIndex - (beforeIndex + beforeText.length);
      if (gap < 0 || gap > 240) {
        return;
      }

      unique.set(`${beforeIndex}:${afterIndex}`, {
        start: beforeIndex + beforeText.length,
        end: afterIndex,
      });
    });

    return Array.from(unique.values());
  }

  if (beforeText) {
    return findAllOccurrences(text, beforeText).map((index) => ({
      start: index + beforeText.length,
      end: index + beforeText.length,
    }));
  }

  if (afterText) {
    return findAllOccurrences(text, afterText).map((index) => ({
      start: index,
      end: index,
    }));
  }

  return [];
}

function replaceTextRangeInWordXml(
  xml: string,
  parsed: ReturnType<typeof parseWordTextSegments>,
  rawStart: number,
  rawEnd: number,
  replacementText: string,
) {
  const segments = parsed.segments;

  if (segments.length === 0) {
    return xml;
  }

  let cursor = 0;
  let inserted = false;
  let nextXml = '';

  segments.forEach((segment) => {
    nextXml += xml.slice(cursor, segment.xmlStart);

    const outsideRange = segment.textEnd < rawStart || segment.textStart > rawEnd || (rawStart === rawEnd && (segment.textEnd < rawStart || segment.textStart > rawStart));

    if (outsideRange) {
      nextXml += xml.slice(segment.xmlStart, segment.xmlEnd);
      cursor = segment.xmlEnd;
      return;
    }

    const startOffset = Math.max(0, Math.min(rawStart - segment.textStart, segment.text.length));
    const endOffset = Math.max(0, Math.min(rawEnd - segment.textStart, segment.text.length));
    const prefix = segment.text.slice(0, startOffset);
    const suffix = segment.text.slice(endOffset);
    const nextText = inserted
      ? `${prefix}${suffix}`
      : `${prefix}${replacementText}${suffix}`;

    inserted = true;
    nextXml += `${segment.openTag}${encodeXml(nextText)}${segment.closeTag}`;
    cursor = segment.xmlEnd;
  });

  nextXml += xml.slice(cursor);
  return nextXml;
}

function decodeXml(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (match, entity) => {
    switch (entity) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default: {
        if (String(entity).startsWith('#x')) {
          return String.fromCodePoint(Number.parseInt(String(entity).slice(2), 16));
        }
        if (String(entity).startsWith('#')) {
          return String.fromCodePoint(Number.parseInt(String(entity).slice(1), 10));
        }
        return match;
      }
    }
  });
}

function encodeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDiffResult(leftFilename: string, rightFilename: string, leftText: string, rightText: string): DocxDiffResult {
  const matcher = new DiffMatchPatch();
  const { chars1, chars2, lineArray } = matcher.diff_linesToChars_(normalizeLineEndings(leftText), normalizeLineEndings(rightText));
  const diffs = matcher.diff_main(chars1, chars2, false);
  matcher.diff_cleanupSemantic(diffs);
  matcher.diff_charsToLines_(diffs, lineArray);

  const lines: DocxDiffLine[] = [];
  let added = 0;
  let removed = 0;
  let modified = 0;
  let diffIndex = 0;

  for (let index = 0; index < diffs.length; index += 1) {
    const [operation, chunk] = diffs[index];
    const chunkLines = splitDiffLines(chunk);

    if (operation === DiffMatchPatch.DIFF_EQUAL) {
      chunkLines.forEach((line) => {
        lines.push({
          left: line,
          right: line,
          type: 'equal',
          diffIndex: null,
        });
      });
      continue;
    }

    if (operation === DiffMatchPatch.DIFF_DELETE) {
      const next = diffs[index + 1];

      if (next && next[0] === DiffMatchPatch.DIFF_INSERT) {
        const insertedLines = splitDiffLines(next[1]);
        const pairLength = Math.max(chunkLines.length, insertedLines.length);

        for (let pairIndex = 0; pairIndex < pairLength; pairIndex += 1) {
          const leftLine = chunkLines[pairIndex] ?? '';
          const rightLine = insertedLines[pairIndex] ?? '';
          diffIndex += 1;

          if (leftLine && rightLine) {
            modified += 1;
            const { leftSegments, rightSegments } = computeIntraLineDiff(matcher, leftLine, rightLine);
            lines.push({
              left: leftLine,
              right: rightLine,
              leftSegments,
              rightSegments,
              type: 'modified',
              diffIndex,
            });
            continue;
          }

          if (leftLine) {
            removed += 1;
            lines.push({ left: leftLine, right: '', type: 'removed', diffIndex });
            continue;
          }

          added += 1;
          lines.push({ left: '', right: rightLine, type: 'added', diffIndex });
        }

        index += 1;
        continue;
      }

      chunkLines.forEach((line) => {
        diffIndex += 1;
        removed += 1;
        lines.push({ left: line, right: '', type: 'removed', diffIndex });
      });
      continue;
    }

    if (operation === DiffMatchPatch.DIFF_INSERT) {
      chunkLines.forEach((line) => {
        diffIndex += 1;
        added += 1;
        lines.push({ left: '', right: line, type: 'added', diffIndex });
      });
    }
  }

  return {
    leftFilename,
    rightFilename,
    lines: lines.length > 0 ? lines : [{ left: '', right: '', type: 'equal', diffIndex: null }],
    stats: {
      added,
      removed,
      modified,
      totalChanges: added + removed + modified,
    },
  };
}

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, '\n');
}

function computeIntraLineDiff(
  matcher: DiffMatchPatch,
  left: string,
  right: string,
): { leftSegments: DocxDiffSegment[]; rightSegments: DocxDiffSegment[] } {
  const diffs = matcher.diff_main(left, right);
  matcher.diff_cleanupSemantic(diffs);

  const leftSegments: DocxDiffSegment[] = [];
  const rightSegments: DocxDiffSegment[] = [];

  for (const [operation, text] of diffs) {
    if (!text) continue;

    if (operation === DiffMatchPatch.DIFF_EQUAL) {
      leftSegments.push({ text, type: 'equal' });
      rightSegments.push({ text, type: 'equal' });
    } else if (operation === DiffMatchPatch.DIFF_DELETE) {
      leftSegments.push({ text, type: 'delete' });
    } else if (operation === DiffMatchPatch.DIFF_INSERT) {
      rightSegments.push({ text, type: 'insert' });
    }
  }

  return { leftSegments, rightSegments };
}

function splitDiffLines(value: string) {
  const parts = normalizeLineEndings(value).split('\n');

  if (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }

  return parts;
}

function formatDocxRenderError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return '문서를 만드는 중 문제가 생겼어요.';
  }

  const message = 'message' in error && typeof error.message === 'string'
    ? error.message
    : '문서를 만드는 중 문제가 생겼어요.';
  const detail = 'properties' in error
    && error.properties
    && typeof error.properties === 'object'
    && 'errors' in error.properties
    && Array.isArray(error.properties.errors)
    ? error.properties.errors
        .map((item) => item?.properties?.explanation || item?.properties?.id)
        .filter(Boolean)
        .join(', ')
    : '';

  return detail ? `${message}: ${detail}` : message;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function assertRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new Error(message);
  }

  return row;
}
