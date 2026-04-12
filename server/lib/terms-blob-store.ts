import fs from 'node:fs';
import path from 'node:path';

const TERMS_BLOBS_DIR = path.resolve(process.cwd(), 'data', 'terms-blobs');

export function ensureTermsBlobDir() {
  if (!fs.existsSync(TERMS_BLOBS_DIR)) {
    fs.mkdirSync(TERMS_BLOBS_DIR, { recursive: true });
  }
}

export function saveTermsBlob(
  assetId: number,
  versionId: number,
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null,
) {
  ensureTermsBlobDir();
  const assetDir = path.join(TERMS_BLOBS_DIR, String(assetId));
  if (!fs.existsSync(assetDir)) {
    fs.mkdirSync(assetDir, { recursive: true });
  }

  const ext = resolveExtension(fileName, mimeType);
  const absolutePath = path.join(assetDir, `${versionId}${ext}`);
  fs.writeFileSync(absolutePath, buffer);
  return toRelativePath(absolutePath);
}

export function saveTermsExtractedText(assetId: number, versionId: number, text: string) {
  ensureTermsBlobDir();
  const assetDir = path.join(TERMS_BLOBS_DIR, String(assetId));
  if (!fs.existsSync(assetDir)) {
    fs.mkdirSync(assetDir, { recursive: true });
  }

  const absolutePath = path.join(assetDir, `${versionId}.txt`);
  fs.writeFileSync(absolutePath, text, 'utf8');
  return toRelativePath(absolutePath);
}

export function readTermsBlob(relativePath: string) {
  return fs.readFileSync(resolveTermsPath(relativePath));
}

export function readTermsText(relativePath: string) {
  return fs.readFileSync(resolveTermsPath(relativePath), 'utf8');
}

export function resolveTermsPath(relativePath: string) {
  return path.resolve(process.cwd(), relativePath);
}

function resolveExtension(fileName: string, mimeType?: string | null) {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.pdf')) return '.pdf';
  if (lowerName.endsWith('.docx')) return '.docx';
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) return '.html';

  const lowerMime = (mimeType ?? '').toLowerCase();
  if (lowerMime.includes('pdf')) return '.pdf';
  if (lowerMime.includes('wordprocessingml')) return '.docx';
  if (lowerMime.includes('html')) return '.html';
  return '.bin';
}

function toRelativePath(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
}
