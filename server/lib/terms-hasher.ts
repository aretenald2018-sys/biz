import { createHash } from 'node:crypto';
import type { ChangeKind } from '@/types/terms';
import { extractTextFromBuffer } from './terms-text';

export interface TermsHashResult {
  raw_hash: string;
  normalized_hash: string;
  raw_text: string;
  normalized_text: string;
}

export async function hashTermsDocument(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null,
): Promise<TermsHashResult> {
  const extraction = await extractTextFromBuffer(buffer, fileName, mimeType);
  return {
    raw_hash: sha256(buffer),
    normalized_hash: sha256(extraction.normalized_text),
    raw_text: extraction.raw_text,
    normalized_text: extraction.normalized_text,
  };
}

export function determineChangeKind(
  previous: { normalized_hash?: string | null } | null | undefined,
  nextNormalizedHash: string,
): ChangeKind {
  if (!previous?.normalized_hash) {
    return 'new';
  }
  if (previous.normalized_hash === nextNormalizedHash) {
    return 'raw_only_change';
  }
  return 'normalized_change';
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}
