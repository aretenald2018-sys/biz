import type { CSSProperties } from 'react';
import type { EmailAttachment } from '@/types/email';
import { normalizeCid, normalizeInlineFileName } from '@/lib/cid-utils';

export const ANNOTATION_COLORS = [
  { bg: 'rgba(255, 220, 100, 0.35)', border: '#ffd54f', label: 'Yellow' },
  { bg: 'rgba(100, 220, 255, 0.30)', border: '#4dd0e1', label: 'Cyan' },
  { bg: 'rgba(255, 150, 200, 0.30)', border: '#f48fb1', label: 'Pink' },
  { bg: 'rgba(150, 255, 150, 0.30)', border: '#81c784', label: 'Green' },
  { bg: 'rgba(200, 170, 255, 0.30)', border: '#b39ddb', label: 'Purple' },
];

export function getAnnotationStyle(color: string, isActive: boolean): CSSProperties {
  const preset = ANNOTATION_COLORS.find((item) => item.border === color) || ANNOTATION_COLORS[0];
  return {
    backgroundColor: isActive ? preset.bg.replace(/[\d.]+\)$/, '0.55)') : preset.bg,
    borderBottom: `3px solid ${preset.border}`,
    borderRadius: '2px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    padding: '1px 0',
    color: 'var(--color-soft-primary)',
  };
}

export function buildCidAttachmentMap(attachments: EmailAttachment[]) {
  const map = new Map<string, string>();
  for (const attachment of attachments) {
    const contentId = normalizeCid(attachment.content_id);
    if (contentId && !map.has(contentId)) {
      map.set(contentId, attachment.id);
    }
  }
  return map;
}

export function buildFileNameAttachmentMap(attachments: EmailAttachment[]) {
  const map = new Map<string, string>();
  for (const attachment of attachments) {
    const normalized = normalizeInlineFileName(attachment.file_name);
    if (normalized && !map.has(normalized)) {
      map.set(normalized, attachment.id);
    }
  }
  return map;
}

export function findByFileNameFallback(cid: string, fileNameMap: Map<string, string>) {
  const token = normalizeCid(cid);
  if (!token) return null;
  const direct = fileNameMap.get(token);
  if (direct) return direct;

  const beforeAt = token.split('@')[0];
  const beforeQuery = beforeAt.split('?')[0];
  const byTrimmed = fileNameMap.get(beforeQuery);
  if (byTrimmed) return byTrimmed;

  for (const [fileName, attachmentId] of fileNameMap.entries()) {
    const fileBase = fileName.split('.')[0];
    const tokenBase = beforeQuery.split('.')[0];
    if (
      fileBase &&
      tokenBase &&
      (fileBase === tokenBase || tokenBase.startsWith(fileBase) || fileBase.startsWith(tokenBase))
    ) {
      return attachmentId;
    }
    if (token.includes(fileName) || fileName.includes(beforeQuery)) {
      return attachmentId;
    }
  }

  return null;
}

export function resolveInlineCidImages(html: string, attachments: EmailAttachment[]) {
  if (!/cid:/i.test(html)) return html;
  if (typeof window === 'undefined') return html;

  const cidMap = buildCidAttachmentMap(attachments);
  const fileNameMap = buildFileNameAttachmentMap(attachments);

  const resolve = (cid: string) => {
    const normalized = normalizeCid(cid) || '';
    const attachmentId = cidMap.get(normalized) || findByFileNameFallback(cid, fileNameMap);
    if (!attachmentId && process.env.NODE_ENV !== 'production') {
      console.debug('[EmailViewer] CID not matched', {
        requestedCid: cid,
        normalizedCid: normalized,
        availableCids: [...cidMap.keys()],
      });
    }
    return attachmentId ? `/api/email-attachments/${attachmentId}` : null;
  };

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img');
  images.forEach((image) => {
    const src = image.getAttribute('src') || '';
    if (!/^cid:/i.test(src)) return;
    const resolved = resolve(src);
    if (!resolved) return;
    image.setAttribute('src', resolved);
    image.setAttribute('alt', '');
  });

  return doc.body.innerHTML;
}
