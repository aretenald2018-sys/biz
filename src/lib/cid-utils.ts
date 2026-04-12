const IMAGE_FILE_RE = /\.(png|jpe?g|gif|bmp|webp|svg|tiff?)$/i;

function hasControlChars(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function hasLikelyMojibake(value: string) {
  return /[\ufffd\ufffe\uffff]/.test(value);
}

export function normalizeCid(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  let cid = value.trim();
  if (!cid) return undefined;

  cid = cid.replace(/^cid:/i, '');
  cid = cid.replace(/^<|>$/g, '');
  cid = cid.replace(/^["']|["']$/g, '');

  try {
    cid = decodeURIComponent(cid);
  } catch {
    // Keep raw token if it is not URL-encoded.
  }

  const normalized = cid.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.length > 320) return undefined;
  if (hasControlChars(normalized)) return undefined;
  if (/\s/.test(normalized)) return undefined;
  if (hasLikelyMojibake(normalized)) return undefined;
  if (!/[a-z0-9]/i.test(normalized)) return undefined;
  return normalized;
}

export function normalizeInlineFileName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const fileName = trimmed.split(/[\\/]/).pop() || trimmed;
  const normalized = fileName.toLowerCase();
  if (!normalized) return undefined;
  if (hasControlChars(normalized)) return undefined;
  if (/\s/.test(normalized)) return undefined;
  return normalized;
}

export function isLikelyImageFileName(fileName: unknown): boolean {
  return typeof fileName === 'string' && IMAGE_FILE_RE.test(fileName.trim());
}

