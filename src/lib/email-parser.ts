import MsgReader from '@kenjiuno/msgreader';
import type { ParsedEmail, EmailRecipient, ParsedEmailAttachment } from '@/types/email';

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

export function parseMsgFile(buffer: ArrayBuffer): ParsedEmail {
  const reader = new MsgReader(buffer);
  const fileData = reader.getFileData();

  const recipients: EmailRecipient[] = [];
  const ccList: EmailRecipient[] = [];

  if (fileData.recipients) {
    for (const r of fileData.recipients) {
      const recipient: EmailRecipient = {
        name: r.name || '',
        email: r.smtpAddress || r.email || '',
        type: 'to',
      };

      const recipType = String(r.recipType || '').toLowerCase();
      if (recipType === 'cc') {
        recipient.type = 'cc';
        ccList.push(recipient);
      } else if (recipType === 'bcc') {
        recipient.type = 'bcc';
      } else {
        recipients.push(recipient);
      }
    }
  }

  // Extract attachments
  const attachments: ParsedEmailAttachment[] = [];
  if (fileData.attachments) {
    for (const att of fileData.attachments) {
      if (att.dataType === 'attachment') {
        try {
          const data = reader.getAttachment(att);
          const attAny = att as unknown as Record<string, unknown>;
          attachments.push({
            fileName: data.fileName || att.name || 'unknown',
            content: Buffer.from(data.content),
            contentType: guessMimeType(data.fileName || att.name || ''),
            contentId: attAny.pidContentId as string | undefined,
            size: data.content.length,
          });
        } catch {
          // Skip unreadable attachments
        }
      }
    }
  }

  const bodyHtml = fileData.bodyHtml || null;
  let bodyText = fileData.body || null;

  // If HTML exists, always derive text from HTML for offset consistency
  if (bodyHtml) {
    bodyText = stripHtmlToText(bodyHtml);
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

interface MimePart {
  headers: Record<string, string>;
  body: string;
}

function parseMimeHeaders(lines: string[]): { headers: Record<string, string>; bodyStart: number } {
  const headers: Record<string, string> = {};
  let currentHeader = '';
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '' || line === '\r') {
      bodyStart = i + 1;
      break;
    }
    if (/^\s/.test(line) && currentHeader) {
      headers[currentHeader] += ' ' + line.trim();
    } else {
      const match = line.match(/^([^:]+):\s*(.*)/);
      if (match) {
        currentHeader = match[1].toLowerCase();
        headers[currentHeader] = (headers[currentHeader] ? headers[currentHeader] + ' ' : '') + match[2];
      }
    }
  }
  return { headers, bodyStart };
}

function decodePartBody(rawBody: string, encoding: string, charset: string): string {
  const enc = (encoding || '').toLowerCase().trim();
  if (enc === 'base64') {
    const cleaned = rawBody.replace(/\s/g, '');
    try {
      const buf = Buffer.from(cleaned, 'base64');
      return buf.toString(charset.toLowerCase().includes('utf') ? 'utf-8' : 'latin1');
    } catch {
      return rawBody;
    }
  } else if (enc === 'quoted-printable') {
    return rawBody
      .replace(/=\r?\n/g, '') // soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return rawBody;
}

function getCharset(contentType: string): string {
  const match = contentType.match(/charset="?([^";\s]+)"?/i);
  return match ? match[1] : 'utf-8';
}

interface ExtractResult {
  text: string | null;
  html: string | null;
  attachments: ParsedEmailAttachment[];
}

function extractBodies(
  bodyText: string,
  contentType: string,
  transferEncoding: string,
): ExtractResult {
  let text: string | null = null;
  let html: string | null = null;
  const attachments: ParsedEmailAttachment[] = [];

  if (contentType.includes('multipart')) {
    const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
    if (!boundaryMatch) return { text: null, html: null, attachments };

    const boundary = boundaryMatch[1];
    const parts = bodyText.split('--' + boundary);

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === '' || trimmed === '--') continue;

      const partLines = trimmed.split(/\r?\n/);
      const { headers: partHeaders, bodyStart } = parseMimeHeaders(partLines);
      const partCT = partHeaders['content-type'] || '';
      const partTE = partHeaders['content-transfer-encoding'] || '';
      const partDisp = partHeaders['content-disposition'] || '';
      const partBody = partLines.slice(bodyStart).join('\n').trim();

      if (partCT.includes('multipart')) {
        const nested = extractBodies(partBody, partCT, partTE);
        if (nested.text && !text) text = nested.text;
        if (nested.html && !html) html = nested.html;
        attachments.push(...nested.attachments);
      } else if (partDisp.includes('attachment') || (partCT && !partCT.includes('text/') && !partCT.includes('multipart'))) {
        // This is an attachment
        const fileNameMatch = (partDisp + ';' + partCT).match(/(?:file)?name="?([^";\n]+)"?/i);
        const fileName = fileNameMatch ? fileNameMatch[1].trim() : 'attachment';
        const contentIdMatch = (partHeaders['content-id'] || '').match(/<([^>]+)>/);
        const charset = getCharset(partCT);
        try {
          const enc = (partTE || '').toLowerCase().trim();
          let buf: Buffer;
          if (enc === 'base64') {
            buf = Buffer.from(partBody.replace(/\s/g, ''), 'base64');
          } else if (enc === 'quoted-printable') {
            const decoded = partBody
              .replace(/=\r?\n/g, '')
              .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
            buf = Buffer.from(decoded, charset.toLowerCase().includes('utf') ? 'utf-8' : 'latin1');
          } else {
            buf = Buffer.from(partBody, 'binary');
          }
          const mimeType = partCT.split(';')[0].trim() || guessMimeType(fileName);
          attachments.push({
            fileName: decodeEncodedWords(fileName),
            content: buf,
            contentType: mimeType,
            contentId: contentIdMatch ? contentIdMatch[1] : undefined,
            size: buf.length,
          });
        } catch {
          // Skip unreadable attachment
        }
      } else {
        const charset = getCharset(partCT);
        const decoded = decodePartBody(partBody, partTE, charset);

        if (partCT.includes('text/html') && !html) {
          html = decoded;
        } else if ((partCT.includes('text/plain') || !partCT) && !text) {
          text = decoded;
        }
      }
    }
  } else {
    const charset = getCharset(contentType);
    const decoded = decodePartBody(bodyText, transferEncoding, charset);

    if (contentType.includes('text/html')) {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  return { text, html, attachments };
}

export function parseEmlFile(rawText: string): ParsedEmail {
  const lines = rawText.split(/\r?\n/);
  const { headers, bodyStart } = parseMimeHeaders(lines);

  const bodyRaw = lines.slice(bodyStart).join('\n');
  const contentType = headers['content-type'] || 'text/plain';
  const transferEncoding = headers['content-transfer-encoding'] || '';

  const { text: bodyText, html: bodyHtml, attachments } = extractBodies(bodyRaw, contentType, transferEncoding);

  // If HTML exists, always derive text from HTML for offset consistency with DOM textContent
  let finalText = bodyText;
  if (bodyHtml) {
    finalText = stripHtmlToText(bodyHtml);
  } else if (!finalText) {
    finalText = null;
  }

  // Parse addresses
  const parseAddress = (raw: string): { name: string; email: string }[] => {
    if (!raw) return [];
    const results: { name: string; email: string }[] = [];
    const parts = raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    for (const part of parts) {
      const trimmed = part.trim();
      const angleMatch = trimmed.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
      if (angleMatch) {
        results.push({ name: angleMatch[1].trim(), email: angleMatch[2].trim() });
      } else if (trimmed.includes('@')) {
        results.push({ name: trimmed, email: trimmed });
      }
    }
    return results;
  };

  const from = parseAddress(decodeEncodedWords(headers['from'] || ''))[0] || { name: '', email: '' };
  const toList = parseAddress(decodeEncodedWords(headers['to'] || ''));
  const ccAddrs = parseAddress(decodeEncodedWords(headers['cc'] || ''));

  const recipients: EmailRecipient[] = toList.map(r => ({ ...r, type: 'to' as const }));
  const ccRecipients: EmailRecipient[] = ccAddrs.map(r => ({ ...r, type: 'cc' as const }));

  let sentDate: string | null = headers['date'] || null;
  if (sentDate) {
    try {
      sentDate = new Date(sentDate).toISOString();
    } catch {
      // keep raw string
    }
  }

  let subject = headers['subject'] || null;
  if (subject) {
    subject = decodeEncodedWords(subject);
  }

  return {
    subject,
    senderName: from.name || from.email || null,
    senderEmail: from.email || null,
    recipients,
    ccList: ccRecipients,
    bodyText: finalText,
    bodyHtml: bodyHtml,
    sentDate,
    attachments,
  };
}

function decodeEncodedWords(str: string): string {
  return str.replace(/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g, (_match, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString(charset.toLowerCase() === 'utf-8' ? 'utf-8' : 'latin1');
      } else {
        const decoded = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        return decoded;
      }
    } catch {
      return text;
    }
  });
}

export function parseEmailFile(buffer: ArrayBuffer, fileName: string): ParsedEmail {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'eml') {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    return parseEmlFile(text);
  }
  return parseMsgFile(buffer);
}
