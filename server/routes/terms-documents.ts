import { createHash } from 'node:crypto';
import path from 'node:path';
import { Hono } from 'hono';
import { getDb } from '@/lib/db';
import type { TermsCaptureResult, TermsDocumentVersion } from '@/types/terms';
import { saveTermsBlob, saveTermsExtractedText } from '../lib/terms-blob-store';
import { splitTermsClauses } from '../lib/terms-clause-splitter';
import {
  buildTermsDocumentDiff,
  ensureTermsBootstrap,
  getLatestTermsVersion,
  getTermsAsset,
  getTermsVersion,
  listTermsVersions,
} from '../lib/terms-db';
import { fetchConditional } from '../lib/terms-fetcher';
import { determineChangeKind } from '../lib/terms-hasher';
import { extractTextFromBuffer } from '../lib/terms-text';

const termsDocumentRoutes = new Hono();
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

termsDocumentRoutes.post('/api/terms/documents/capture/:assetId', async (c) => {
  const db = getTermsDb();
  const assetId = Number.parseInt(c.req.param('assetId'), 10);
  const asset = getTermsAsset(db, assetId);

  if (!asset) {
    return c.json({ error: '대상 asset을 찾지 못했습니다.' }, 404);
  }

  const body = await c.req.json<{ force?: boolean }>().catch(() => ({}));
  const previous = getLatestTermsVersion(db, assetId);
  const result = await fetchConditional(asset, previous, { force: Boolean(body.force) });

  if (result.blockedByRobots) {
    const failure = recordFailedCapture(db, assetId, {
      capture_source: 'auto_fetch',
      http_status: -1,
    });
    return c.json({ ...failure, blocked_by_robots: true });
  }

  if (result.status === 304) {
    db.prepare(`
      UPDATE terms_assets
      SET last_seen_at = datetime('now','localtime'),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(assetId);

    const payload: TermsCaptureResult = {
      asset_id: assetId,
      status: 304,
      change_kind: 'none',
    };
    return c.json(payload);
  }

  if (!result.buf || result.status < 200 || result.status >= 300) {
    const failure = recordFailedCapture(db, assetId, {
      capture_source: 'auto_fetch',
      http_status: result.status,
    });
    return c.json({ ...failure, error: '문서 원본을 가져오지 못했습니다.' }, 400);
  }

  const version = await ingestTermsVersion(db, {
    assetId,
    buffer: result.buf,
    capture_source: 'auto_fetch',
    etag: result.etag ?? null,
    fileName: inferFileName(asset.url, result.finalUrl, result.mime),
    finalUrl: result.finalUrl ?? asset.url,
    http_status: result.status,
    last_modified_header: result.lastModified ?? null,
    mimeType: result.mime ?? null,
    uploaded_by: null,
  });

  return c.json(version);
});

termsDocumentRoutes.post('/api/terms/documents/upload/:assetId', async (c) => {
  const db = getTermsDb();
  const assetId = Number.parseInt(c.req.param('assetId'), 10);
  const asset = getTermsAsset(db, assetId);

  if (!asset) {
    return c.json({ error: '대상 asset을 찾지 못했습니다.' }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return c.json({ error: '업로드할 파일이 필요합니다.' }, 400);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: '업로드 가능 용량을 초과했습니다.' }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.name.toLowerCase().endsWith('.docx')) {
    if (buffer.length < 4) {
      return c.json({ error: `파일이 비어있거나 손상되었습니다 (${file.name}).` }, 400);
    }
    const b0 = buffer[0];
    const b1 = buffer[1];
    const b2 = buffer[2];
    const isZip = b0 === 0x50 && b1 === 0x4b && (b2 === 0x03 || b2 === 0x05 || b2 === 0x07);
    console.log(
      `[terms-docx-validate] name=${file.name} size=${buffer.length} head=${buffer.slice(0, 4).toString('hex')}`,
    );
    if (!isZip) {
      return c.json(
        {
          error:
            `워드 파일이 정상적으로 전송되지 않았습니다 (${file.name}). ` +
            `OneDrive/Dropbox 동기화 중이거나 백신 스캔 중일 수 있습니다. ` +
            `로컬 디스크 기본 폴더(예: 바탕화면)로 파일을 복사한 뒤 다시 업로드해 주세요.`,
        },
        400,
      );
    }
  }

  const version = await ingestTermsVersion(db, {
    assetId,
    buffer,
    capture_source: 'manual_upload',
    etag: null,
    fileName: file.name,
    finalUrl: asset.url,
    http_status: 200,
    last_modified_header: null,
    mimeType: file.type || null,
    uploaded_by: normalizeUploadedBy(formData.get('uploaded_by')),
  });

  return c.json(version, 201);
});

// 직접 약관 입력: 텍스트 또는 파일로 받아 synthetic asset + version 생성.
termsDocumentRoutes.post('/api/terms/documents/manual-input/:marketEntity', async (c) => {
  const db = getTermsDb();
  const marketEntity = c.req.param('marketEntity');

  const entity = db.prepare('SELECT code FROM terms_market_entities WHERE code = ?').get(marketEntity);
  if (!entity) {
    return c.json({ error: '대상 법인을 찾지 못했습니다.' }, 404);
  }

  const formData = await c.req.formData();
  const text = formData.get('text');
  const file = formData.get('file');
  const title = (formData.get('title') as string | null) ?? null;
  const serviceFamily = (formData.get('service_family') as string | null) ?? 'website';
  const documentType = (formData.get('document_type') as string | null) ?? 'privacy_policy';

  let buffer: Buffer;
  let fileName: string;
  let mimeType: string | null = null;

  if (file instanceof File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return c.json({ error: '업로드 가능 용량을 초과했습니다.' }, 400);
    }
    buffer = Buffer.from(await file.arrayBuffer());
    fileName = file.name || 'manual-input';
    mimeType = file.type || null;
    if (fileName.toLowerCase().endsWith('.docx')) {
      if (buffer.length < 4) {
        return c.json({ error: `파일이 비어있거나 손상되었습니다 (${fileName}).` }, 400);
      }
      const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b &&
        (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
      if (!isZip) {
        return c.json({ error: `워드 파일이 정상적으로 전송되지 않았습니다 (${fileName}).` }, 400);
      }
    }
  } else if (typeof text === 'string' && text.trim()) {
    buffer = Buffer.from(text, 'utf8');
    fileName = `${title ?? 'manual-input'}.txt`;
    mimeType = 'text/plain';
  } else {
    return c.json({ error: '텍스트 또는 파일을 입력해주세요.' }, 400);
  }

  // 동일 법인에 대해 `manual://` prefix 를 갖는 synthetic URL 로 asset 을 만든다.
  // 미리보기 단계 후 확정되지 않으면 나중에 정리 가능.
  const syntheticUrl = `manual://${marketEntity}/${Date.now()}`;
  const insertAsset = db.prepare(`
    INSERT INTO terms_assets (
      market_entity, controller_entity, service_family, document_type, channel, url,
      language, auth_required, monitoring_tier, verification_status,
      last_updated_text, effective_date, owner_team, notes
    )
    VALUES (?, NULL, ?, ?, 'html', ?, NULL, 0, 'P2_monthly', 'unverified', NULL, NULL, NULL, ?)
  `).run(marketEntity, serviceFamily, documentType, syntheticUrl, title ?? '수동 입력');
  const assetId = Number(insertAsset.lastInsertRowid);

  const version = await ingestTermsVersion(db, {
    assetId,
    buffer,
    capture_source: 'manual_upload',
    etag: null,
    fileName,
    finalUrl: syntheticUrl,
    http_status: 200,
    last_modified_header: null,
    mimeType,
    uploaded_by: 'manual',
  });

  return c.json({ asset_id: assetId, version }, 201);
});

termsDocumentRoutes.get('/api/terms/documents/:assetId/versions', (c) => {
  const db = getTermsDb();
  const assetId = Number.parseInt(c.req.param('assetId'), 10);
  const asset = getTermsAsset(db, assetId);

  if (!asset) {
    return c.json({ error: '대상 asset을 찾지 못했습니다.' }, 404);
  }

  return c.json({
    asset,
    versions: listTermsVersions(db, assetId),
  });
});

termsDocumentRoutes.get('/api/terms/documents/diff/:versionId', (c) => {
  const db = getTermsDb();
  const versionId = Number.parseInt(c.req.param('versionId'), 10);
  const version = getTermsVersion(db, versionId);

  if (!version) {
    return c.json({ error: '대상 버전을 찾지 못했습니다.' }, 404);
  }

  return c.json(buildTermsDocumentDiff(db, versionId));
});

async function ingestTermsVersion(
  db: ReturnType<typeof getDb>,
  input: {
    assetId: number;
    buffer: Buffer;
    capture_source: TermsDocumentVersion['capture_source'];
    etag: string | null;
    fileName: string;
    finalUrl: string;
    http_status: number | null;
    last_modified_header: string | null;
    mimeType: string | null;
    uploaded_by: string | null;
  },
) {
  const asset = getTermsAsset(db, input.assetId);
  if (!asset) {
    throw new Error('대상 asset을 찾지 못했습니다.');
  }

  const previous = getLatestTermsVersion(db, input.assetId);
  const extraction = await extractTextFromBuffer(input.buffer, input.fileName, input.mimeType);
  const raw_hash = sha256(input.buffer);
  const normalized_hash = sha256(extraction.normalized_text);
  const change_kind = determineChangeKind(previous, normalized_hash);
  const extractedLastUpdated = extractDateMarker(extraction.raw_text, ['last updated', 'updated', 'effective']);

  const result = db.prepare(`
    INSERT INTO terms_document_versions (
      asset_id,
      capture_source,
      http_status,
      etag,
      last_modified_header,
      raw_hash,
      normalized_hash,
      mime_type,
      extracted_last_updated,
      diff_from_prev_id,
      change_kind,
      uploaded_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.assetId,
    input.capture_source,
    input.http_status,
    input.etag,
    input.last_modified_header,
    raw_hash,
    normalized_hash,
    input.mimeType,
    extractedLastUpdated,
    previous?.id ?? null,
    change_kind,
    input.uploaded_by,
  );

  const versionId = Number(result.lastInsertRowid);
  const blobPath = saveTermsBlob(input.assetId, versionId, input.buffer, input.fileName, input.mimeType);
  const textPath = saveTermsExtractedText(input.assetId, versionId, extraction.raw_text);
  const clauses = splitTermsClauses({
    html: extraction.html ?? null,
    language: asset.language ?? null,
    text: extraction.raw_text,
  });

  const persist = db.transaction(() => {
    db.prepare(`
      UPDATE terms_document_versions
      SET blob_path = ?,
          extracted_text_path = ?,
          extracted_last_updated = ?
      WHERE id = ?
    `).run(blobPath, textPath, extractedLastUpdated, versionId);

    const insertClause = db.prepare(`
      INSERT INTO terms_clauses (
        version_id,
        path,
        heading,
        body,
        language,
        order_index,
        char_start,
        char_end
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    clauses.forEach((clause) => {
      insertClause.run(
        versionId,
        clause.path ?? null,
        clause.heading ?? null,
        clause.body,
        clause.language ?? null,
        clause.order_index,
        clause.char_start ?? null,
        clause.char_end ?? null,
      );
    });

    db.prepare(`
      UPDATE terms_assets
      SET url = ?,
          verification_status = ?,
          last_updated_text = COALESCE(?, last_updated_text),
          last_seen_at = datetime('now','localtime'),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.finalUrl || asset.url,
      resolveVerificationStatus(asset.verification_status, input.capture_source, input.http_status),
      extractedLastUpdated,
      input.assetId,
    );
  });
  persist();

  return getTermsVersion(db, versionId);
}

function recordFailedCapture(
  db: ReturnType<typeof getDb>,
  assetId: number,
  input: {
    capture_source: TermsDocumentVersion['capture_source'];
    http_status: number;
  },
) {
  const result = db.prepare(`
    INSERT INTO terms_document_versions (
      asset_id,
      capture_source,
      http_status,
      change_kind
    )
    VALUES (?, ?, ?, 'none')
  `).run(assetId, input.capture_source, input.http_status);

  db.prepare(`
    UPDATE terms_assets
    SET verification_status = 'broken',
        last_seen_at = datetime('now','localtime'),
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(assetId);

  return {
    asset_id: assetId,
    version_id: Number(result.lastInsertRowid),
    status: input.http_status,
    change_kind: 'none' as const,
  };
}

function getTermsDb() {
  const db = getDb();
  ensureTermsBootstrap(db);
  return db;
}

function inferFileName(assetUrl: string, finalUrl?: string, mimeType?: string | null) {
  const source = finalUrl || assetUrl;
  try {
    const parsed = new URL(source);
    const base = path.basename(parsed.pathname);
    if (base) {
      return base;
    }
  } catch {
    return 'terms-document';
  }

  if (mimeType?.toLowerCase().includes('pdf')) return 'terms-document.pdf';
  if (mimeType?.toLowerCase().includes('html')) return 'terms-document.html';
  return 'terms-document';
}

function normalizeUploadedBy(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function extractDateMarker(text: string, labels: string[]) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!labels.some((label) => lower.includes(label))) {
      continue;
    }
    return line.slice(0, 140);
  }

  return null;
}

function resolveVerificationStatus(
  currentStatus: string,
  captureSource: TermsDocumentVersion['capture_source'],
  httpStatus: number | null,
) {
  if (httpStatus == null || httpStatus < 200 || httpStatus >= 300) {
    return 'broken';
  }
  if (captureSource === 'auto_fetch') {
    return 'verified';
  }
  return currentStatus || 'unverified';
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

export default termsDocumentRoutes;
