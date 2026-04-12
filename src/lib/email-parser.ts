import MsgReader from '@kenjiuno/msgreader';
import type { ParsedEmail, EmailRecipient, ParsedEmailAttachment } from '@/types/email';
import { isLikelyImageFileName, normalizeCid, normalizeInlineFileName } from '@/lib/cid-utils';

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.htm': 'text/html',
  '.html': 'text/html',
};

function guessMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

function decodeBufferWithCharset(buffer: Buffer, charset: string): string {
  const normalized = (charset || 'utf-8').trim().toLowerCase();
  const candidates = [normalized, 'utf-8', 'latin1'];
  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate, { fatal: false }).decode(buffer);
    } catch {
      continue;
    }
  }
  return buffer.toString('utf-8');
}

// HTML <meta charset> / <meta http-equiv="Content-Type"> 또는 BOM에서 charset 추출.
// 못 찾으면 'utf-8'.
function detectHtmlCharset(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf-8';
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';

  // 헤드 4KB만 latin1로 훑어 메타 태그 검색 (한글 깨져도 ASCII 메타는 그대로 보임)
  const head = buffer.slice(0, Math.min(buffer.length, 4096)).toString('latin1');
  const metaCharset = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i);
  if (metaCharset?.[1]) return metaCharset[1].toLowerCase();
  const httpEquiv = head.match(/content\s*=\s*["'][^"']*charset=([\w-]+)/i);
  if (httpEquiv?.[1]) return httpEquiv[1].toLowerCase();

  return 'utf-8';
}

function decodeQuotedPrintableToBuffer(input: string): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '=') {
      if (input[i + 1] === '\r' && input[i + 2] === '\n') {
        i += 2;
        continue;
      }
      if (input[i + 1] === '\n') {
        i += 1;
        continue;
      }
      const hex = input.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0));
  }
  return Buffer.from(bytes);
}

function decodeTransferToBuffer(body: string, transferEncoding: string): Buffer {
  const encoding = transferEncoding.toLowerCase().trim();
  if (encoding === 'base64') {
    const cleaned = body.replace(/\s/g, '');
    try {
      return Buffer.from(cleaned, 'base64');
    } catch {
      return Buffer.from(body, 'binary');
    }
  }
  if (encoding === 'quoted-printable') {
    return decodeQuotedPrintableToBuffer(body);
  }
  return Buffer.from(body, 'binary');
}

function parseMimeMessage(raw: string): { headers: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const headers: Record<string, string> = {};

  let i = 0;
  let currentHeader = '';
  while (i < lines.length) {
    const line = lines[i];
    if (line === '') {
      i += 1;
      break;
    }
    if ((line.startsWith(' ') || line.startsWith('\t')) && currentHeader) {
      headers[currentHeader] = `${headers[currentHeader]} ${line.trim()}`;
    } else {
      const idx = line.indexOf(':');
      if (idx > 0) {
        currentHeader = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        headers[currentHeader] = headers[currentHeader] ? `${headers[currentHeader]}, ${value}` : value;
      }
    }
    i += 1;
  }

  return { headers, body: lines.slice(i).join('\n') };
}

function parseHeaderParams(headerValue: string): { value: string; params: Record<string, string> } {
  const [head, ...rest] = headerValue.split(';');
  const value = (head || '').trim();
  const params: Record<string, string> = {};

  for (const chunk of rest) {
    const idx = chunk.indexOf('=');
    if (idx <= 0) continue;
    const key = chunk.slice(0, idx).trim().toLowerCase();
    let paramValue = chunk.slice(idx + 1).trim();
    if (paramValue.startsWith('"') && paramValue.endsWith('"')) {
      paramValue = paramValue.slice(1, -1);
    }
    params[key] = paramValue;
  }

  return { value, params };
}

function decodeRfc2231Value(value: string): string {
  const parts = value.split("'");
  if (parts.length >= 3) {
    const charset = parts[0] || 'utf-8';
    const encoded = parts.slice(2).join("'");
    try {
      const bytes: number[] = [];
      for (let i = 0; i < encoded.length; i += 1) {
        const char = encoded[i];
        if (char === '%' && /^[0-9A-Fa-f]{2}$/.test(encoded.slice(i + 1, i + 3))) {
          bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
          i += 2;
        } else {
          bytes.push(char.charCodeAt(0));
        }
      }
      return decodeBufferWithCharset(Buffer.from(bytes), charset);
    } catch {
      return encoded;
    }
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeEncodedWords(input: string): string {
  return input.replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_full, charset, encoding, encodedText) => {
    try {
      if (String(encoding).toUpperCase() === 'B') {
        return decodeBufferWithCharset(Buffer.from(String(encodedText), 'base64'), String(charset));
      }
      const qp = String(encodedText).replace(/_/g, ' ');
      const buffer = decodeQuotedPrintableToBuffer(qp);
      return decodeBufferWithCharset(buffer, String(charset));
    } catch {
      return String(encodedText);
    }
  });
}

function getHeaderParam(params: Record<string, string>, name: string): string | null {
  const key = name.toLowerCase();
  if (params[key]) {
    return decodeEncodedWords(params[key]);
  }
  if (params[`${key}*`]) {
    return decodeRfc2231Value(params[`${key}*`]);
  }

  const fragments = Object.entries(params)
    .filter(([paramKey]) => paramKey.startsWith(`${key}*`))
    .map(([paramKey, value]) => ({ key: paramKey, value }))
    .sort((a, b) => {
      const aNum = Number((a.key.match(/\*(\d+)/) || [])[1] || 0);
      const bNum = Number((b.key.match(/\*(\d+)/) || [])[1] || 0);
      return aNum - bNum;
    });

  if (fragments.length === 0) return null;

  const joined = fragments.map(({ key: fragmentKey, value }) => {
    if (fragmentKey.endsWith('*')) {
      return decodeRfc2231Value(value);
    }
    return value;
  }).join('');

  return decodeEncodedWords(joined);
}

function splitMultipartBody(body: string, boundary: string): string[] {
  const normalized = body.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const startBoundary = `--${boundary}`;
  const endBoundary = `--${boundary}--`;
  const parts: string[] = [];
  let current: string[] = [];
  let inPart = false;

  for (const line of lines) {
    if (line === startBoundary) {
      if (inPart && current.length > 0) {
        parts.push(current.join('\n'));
      }
      inPart = true;
      current = [];
      continue;
    }
    if (line === endBoundary) {
      if (inPart && current.length > 0) {
        parts.push(current.join('\n'));
      }
      break;
    }
    if (inPart) {
      current.push(line);
    }
  }

  if (parts.length === 0) {
    return normalized.split(startBoundary).map((chunk) => chunk.trim()).filter((chunk) => chunk && chunk !== '--');
  }

  return parts;
}

function parseAddressList(rawValue: string): { name: string; email: string }[] {
  if (!rawValue) return [];
  const decoded = decodeEncodedWords(rawValue);
  const parts = decoded.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const recipients: { name: string; email: string }[] = [];

  for (const part of parts) {
    const token = part.trim();
    if (!token) continue;

    const angle = token.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
    if (angle) {
      recipients.push({
        name: angle[1].trim(),
        email: angle[2].trim(),
      });
      continue;
    }

    const emailOnly = token.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (emailOnly) {
      recipients.push({
        name: token.replace(emailOnly[1], '').replace(/[<>"]/g, '').trim() || emailOnly[1],
        email: emailOnly[1].trim(),
      });
    }
  }

  return recipients;
}

function normalizeRecipientType(value: unknown): 'to' | 'cc' | 'bcc' {
  const token = String(value || '').toLowerCase();
  if (token.includes('cc')) return 'cc';
  if (token.includes('bcc')) return 'bcc';
  return 'to';
}

function extractAttachmentContentId(att: Record<string, unknown>, data?: Record<string, unknown>): string | undefined {
  const directKeys = ['pidContentId', 'contentId', 'content_id', 'content-id', 'attachContentId', 'bodyContentId', 'cid'] as const;
  for (const key of directKeys) {
    const normalized = normalizeCid(att[key]);
    if (normalized) return normalized;
  }
  if (data) {
    for (const key of directKeys) {
      const normalized = normalizeCid(data[key]);
      if (normalized) return normalized;
    }
  }

  const searchRawProps = (rawProps: unknown): string | undefined => {
    if (!rawProps) return undefined;
    const values = Array.isArray(rawProps) ? rawProps : Object.values(rawProps as Record<string, unknown>);
    for (const value of values) {
      if (!value || typeof value !== 'object') continue;
      const record = value as Record<string, unknown>;
      const tag = String(
        record.propertyTag ?? record.tag ?? record.id ?? record.propertyId ?? record.key ?? '',
      ).toLowerCase().replace(/^0x/, '');
      if (!tag.includes('3712001f') && !tag.includes('3712001e')) continue;
      const cid = normalizeCid(record.value ?? record.data ?? record.content ?? record.string);
      if (cid) return cid;
    }
    return undefined;
  };

  const fromAttachmentRaw = searchRawProps(att.rawProps);
  if (fromAttachmentRaw) return fromAttachmentRaw;

  if (data) {
    const fromDataRaw = searchRawProps(data.rawProps);
    if (fromDataRaw) return fromDataRaw;
  }

  const fileName = normalizeInlineFileName(data?.fileName || att.fileName || att.name);
  if (fileName && isLikelyImageFileName(fileName)) {
    return fileName;
  }
  return undefined;
}

interface ExtractResult {
  text: string | null;
  html: string | null;
  attachments: ParsedEmailAttachment[];
}

function isAttachmentPart(
  mimeType: string,
  dispositionValue: string,
  fileName: string | null,
  contentId: string | null,
): boolean {
  const disposition = dispositionValue.toLowerCase();
  if (disposition.includes('attachment')) return true;
  if (fileName && disposition.includes('inline')) return true;
  if (fileName && !mimeType.startsWith('text/')) return true;
  if (contentId && !mimeType.startsWith('text/plain')) return true;
  if (!mimeType.startsWith('text/') && !mimeType.startsWith('multipart/') && mimeType !== 'message/rfc822') return true;
  return false;
}

function extractBodies(node: { headers: Record<string, string>; body: string }, defaultContentType = 'text/plain'): ExtractResult {
  const contentTypeHeader = node.headers['content-type'] || defaultContentType;
  const transferEncoding = node.headers['content-transfer-encoding'] || '';
  const dispositionHeader = node.headers['content-disposition'] || '';
  const parsedContentType = parseHeaderParams(contentTypeHeader);
  const parsedDisposition = parseHeaderParams(dispositionHeader);
  const mimeType = parsedContentType.value.toLowerCase() || 'text/plain';
  const charset = parsedContentType.params.charset || 'utf-8';

  if (mimeType.startsWith('multipart/')) {
    const boundary = getHeaderParam(parsedContentType.params, 'boundary');
    if (!boundary) {
      const decoded = decodeBufferWithCharset(decodeTransferToBuffer(node.body, transferEncoding), charset);
      if (mimeType.includes('html')) return { text: null, html: decoded, attachments: [] };
      return { text: decoded, html: null, attachments: [] };
    }

    const parts = splitMultipartBody(node.body, boundary);
    const merged: ExtractResult = { text: null, html: null, attachments: [] };
    for (const partRaw of parts) {
      const nested = extractBodies(parseMimeMessage(partRaw), 'text/plain');
      if (!merged.text && nested.text) merged.text = nested.text;
      if (!merged.html && nested.html) merged.html = nested.html;
      merged.attachments.push(...nested.attachments);
    }
    return merged;
  }

  if (mimeType === 'message/rfc822') {
    return extractBodies(parseMimeMessage(node.body), 'text/plain');
  }

  const buffer = decodeTransferToBuffer(node.body, transferEncoding);
  const text = decodeBufferWithCharset(buffer, charset);
  const fileName =
    getHeaderParam(parsedDisposition.params, 'filename') ||
    getHeaderParam(parsedContentType.params, 'name');
  const contentId = normalizeCid(node.headers['content-id'] || node.headers['x-attachment-id']) || null;
  const isAttachment = isAttachmentPart(mimeType, parsedDisposition.value, fileName, contentId);

  if (isAttachment) {
    const normalizedFileName = decodeEncodedWords(fileName || 'attachment');
    const attachment: ParsedEmailAttachment = {
      fileName: normalizedFileName,
      content: buffer,
      contentType: mimeType || guessMimeType(normalizedFileName),
      contentId: contentId || undefined,
      size: buffer.length,
    };
    return { text: null, html: null, attachments: [attachment] };
  }

  if (mimeType.includes('text/html')) return { text: null, html: text, attachments: [] };
  return { text, html: null, attachments: [] };
}

export function parseMsgFile(buffer: ArrayBuffer): ParsedEmail {
  const reader = new MsgReader(buffer);
  reader.parserConfig = { includeRawProps: true };
  const fileData = reader.getFileData();

  const recipients: EmailRecipient[] = [];
  const ccList: EmailRecipient[] = [];

  for (const recipientRaw of fileData.recipients || []) {
    const recipientType = normalizeRecipientType(recipientRaw.recipType);
    const recipient: EmailRecipient = {
      name: recipientRaw.name || '',
      email: recipientRaw.smtpAddress || recipientRaw.email || '',
      type: recipientType,
    };
    if (recipientType === 'cc') {
      ccList.push(recipient);
    } else {
      recipients.push(recipient);
    }
  }

  const attachments: ParsedEmailAttachment[] = [];
  for (const attachmentRaw of fileData.attachments || []) {
    if (attachmentRaw.dataType === 'msg') continue;
    try {
      const attachmentData = reader.getAttachment(attachmentRaw);
      const attAny = attachmentRaw as unknown as Record<string, unknown>;
      const dataAny = attachmentData as unknown as Record<string, unknown>;
      const fileName = attachmentData.fileName || attachmentRaw.name || 'unknown';
      const content = Buffer.from(attachmentData.content);
      attachments.push({
        fileName,
        content,
        contentType: guessMimeType(fileName),
        contentId: extractAttachmentContentId(attAny, dataAny),
        size: content.length,
      });
    } catch {
      continue;
    }
  }

  // MsgReader may return HTML body under `bodyHtml` (string) or `html`
  // (Uint8Array / object with byte values).  Normalise both to string.
  const fileDataAny = fileData as unknown as Record<string, unknown>;
  let bodyHtml: string | null = null;

  if (typeof fileData.bodyHtml === 'string' && fileData.bodyHtml.length > 0) {
    bodyHtml = fileData.bodyHtml;
  } else if (fileDataAny.html != null) {
    const raw = fileDataAny.html;
    if (typeof raw === 'string') {
      bodyHtml = raw;
    } else if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
      const buf = Buffer.from(raw);
      bodyHtml = decodeBufferWithCharset(buf, detectHtmlCharset(buf));
    } else if (typeof raw === 'object') {
      // Some MsgReader versions return an object with numeric keys (byte map)
      try {
        const bytes = Object.values(raw as Record<string, number>);
        const buf = Buffer.from(bytes);
        bodyHtml = decodeBufferWithCharset(buf, detectHtmlCharset(buf));
      } catch {
        bodyHtml = null;
      }
    }
  }

  let bodyText = fileData.body || null;
  if (bodyHtml) {
    const stripped = stripHtmlToText(bodyHtml);
    if (stripped) bodyText = stripped;
  } else if (bodyText && /<\/?[a-z][\s\S]*>/i.test(bodyText)) {
    bodyText = stripHtmlToText(bodyText) || bodyText;
  }

  return {
    subject: fileData.subject || null,
    senderName: fileData.senderName || null,
    senderEmail: fileData.senderSmtpAddress || fileData.senderEmail || null,
    recipients,
    ccList,
    bodyText,
    bodyHtml,
    sentDate: fileData.messageDeliveryTime || fileData.clientSubmitTime || null,
    attachments,
  };
}

export function parseEmlFile(rawText: string): ParsedEmail {
  const root = parseMimeMessage(rawText);
  const extracted = extractBodies(root, 'text/plain');
  const from = parseAddressList(root.headers.from || '')[0] || { name: '', email: '' };
  const toList = parseAddressList(root.headers.to || '');
  const ccRaw = parseAddressList(root.headers.cc || '');

  let sentDate: string | null = root.headers.date || null;
  if (sentDate) {
    const parsed = Date.parse(sentDate);
    if (!Number.isNaN(parsed)) {
      sentDate = new Date(parsed).toISOString();
    }
  }

  const subject = root.headers.subject ? decodeEncodedWords(root.headers.subject) : null;
  const bodyHtml = extracted.html;
  let bodyText = extracted.text;
  if (bodyHtml) {
    const stripped = stripHtmlToText(bodyHtml);
    if (stripped) bodyText = stripped;
  }

  return {
    subject,
    senderName: from.name || from.email || null,
    senderEmail: from.email || null,
    recipients: toList.map((recipient) => ({ ...recipient, type: 'to' as const })),
    ccList: ccRaw.map((recipient) => ({ ...recipient, type: 'cc' as const })),
    bodyText: bodyText || null,
    bodyHtml,
    sentDate,
    attachments: extracted.attachments,
  };
}

export function parseEmailFile(buffer: ArrayBuffer, fileName: string): ParsedEmail {
  const emptyEmail: ParsedEmail = {
    subject: fileName || null,
    senderName: null,
    senderEmail: null,
    recipients: [],
    ccList: [],
    bodyText: null,
    bodyHtml: null,
    sentDate: null,
    attachments: [],
  };

  try {
    const extension = fileName.toLowerCase().split('.').pop();
    if (extension === 'eml') {
      const text = new TextDecoder('utf-8').decode(buffer);
      const parsed = parseEmlFile(text);
      return { ...parsed, subject: parsed.subject || fileName };
    }
    const parsed = parseMsgFile(buffer);
    return { ...parsed, subject: parsed.subject || fileName };
  } catch (error) {
    console.error('Failed to parse email file, fallback result returned:', error);
    try {
      const text = new TextDecoder('utf-8').decode(buffer);
      return {
        ...emptyEmail,
        bodyText: text.slice(0, 5000) || null,
      };
    } catch {
      return emptyEmail;
    }
  }
}
