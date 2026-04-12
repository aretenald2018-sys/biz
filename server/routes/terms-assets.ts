import { Hono } from 'hono';
import { getDb } from '@/lib/db';
import type { TermsAssetInput, TermsAssetPatchInput, TermsDiscoveryResult } from '@/types/terms';
import { discoverTermsCandidates } from '../lib/terms-discovery';
import {
  ensureTermsBootstrap,
  findTermsAssetBySignature,
  getTermsCandidate,
  getTermsAsset,
  insertTermsAsset,
  listTermsAssets,
  listTermsCandidates,
  parseTermsAssetInput,
  toNullableReviewer,
  validateTermsAssetInput,
} from '../lib/terms-db';

const termsAssetRoutes = new Hono();

termsAssetRoutes.get('/api/terms/market-entities', (c) => {
  const db = getTermsDb();
  const rows = db.prepare(`
    SELECT *
    FROM terms_market_entities
    ORDER BY brand ASC, region ASC, country ASC, display_name ASC
  `).all();
  return c.json(rows);
});

termsAssetRoutes.get('/api/terms/controllers', (c) => {
  const db = getTermsDb();
  const rows = db.prepare(`
    SELECT *
    FROM terms_controllers
    ORDER BY legal_name ASC
  `).all();
  return c.json(rows);
});

termsAssetRoutes.get('/api/terms/assets', (c) => {
  const assets = listTermsAssets(getTermsDb(), {
    market_entity: c.req.query('market_entity') ?? null,
    service_family: c.req.query('service_family') ?? null,
    document_type: c.req.query('document_type') ?? null,
    verification_status: c.req.query('verification_status') ?? null,
  });
  return c.json(assets);
});

termsAssetRoutes.post('/api/terms/assets', async (c) => {
  const db = getTermsDb();
  const payload = parseTermsAssetInput(await c.req.json<Partial<TermsAssetInput>>());
  validateTermsAssetInput(payload);

  const existing = findTermsAssetBySignature(db, payload);
  if (existing) {
    return c.json({ error: '동일한 asset이 이미 존재합니다.', asset: existing }, 409);
  }

  const asset = insertTermsAsset(db, payload);
  return c.json(asset, 201);
});

termsAssetRoutes.put('/api/terms/assets/:id', async (c) => {
  const db = getTermsDb();
  const assetId = Number.parseInt(c.req.param('id'), 10);
  const current = getTermsAsset(db, assetId);

  if (!current) {
    return c.json({ error: '대상 asset을 찾지 못했습니다.' }, 404);
  }

  const patch = await c.req.json<TermsAssetPatchInput>();
  const next = parseTermsAssetInput({
    ...current,
    ...patch,
  });
  validateTermsAssetInput(next);

  db.prepare(`
    UPDATE terms_assets
    SET market_entity = ?,
        controller_entity = ?,
        service_family = ?,
        document_type = ?,
        channel = ?,
        url = ?,
        language = ?,
        auth_required = ?,
        monitoring_tier = ?,
        verification_status = ?,
        last_updated_text = ?,
        effective_date = ?,
        last_seen_at = ?,
        owner_team = ?,
        notes = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    next.market_entity,
    next.controller_entity ?? null,
    next.service_family,
    next.document_type,
    next.channel,
    next.url,
    next.language ?? null,
    next.auth_required ? 1 : 0,
    next.monitoring_tier,
    next.verification_status,
    next.last_updated_text ?? null,
    next.effective_date ?? null,
    next.last_seen_at ?? null,
    next.owner_team ?? null,
    next.notes ?? null,
    assetId,
  );

  return c.json(getTermsAsset(db, assetId));
});

termsAssetRoutes.delete('/api/terms/assets/:id', (c) => {
  const db = getTermsDb();
  const assetId = Number.parseInt(c.req.param('id'), 10);
  db.prepare('DELETE FROM terms_assets WHERE id = ?').run(assetId);
  return c.json({ ok: true });
});

termsAssetRoutes.get('/api/terms/candidates', (c) => {
  const candidates = listTermsCandidates(getTermsDb(), c.req.query('status') ?? null);
  return c.json(candidates);
});

termsAssetRoutes.post('/api/terms/candidates/:id/promote', async (c) => {
  const db = getTermsDb();
  const candidateId = Number.parseInt(c.req.param('id'), 10);
  const candidate = getTermsCandidate(db, candidateId);

  if (!candidate) {
    return c.json({ error: '대상 candidate를 찾지 못했습니다.' }, 404);
  }

  const body = await c.req.json<{
    reviewer?: string;
    asset?: Partial<TermsAssetInput>;
  }>().catch(() => ({}));

  const payload = parseTermsAssetInput({
    market_entity: body.asset?.market_entity ?? candidate.hint_market_entity ?? '',
    controller_entity: body.asset?.controller_entity ?? null,
    service_family: body.asset?.service_family ?? candidate.hint_service_family ?? '',
    document_type: body.asset?.document_type ?? candidate.hint_document_type ?? '',
    channel: body.asset?.channel ?? inferChannel(candidate.candidate_url),
    url: body.asset?.url ?? candidate.candidate_url,
    language: body.asset?.language ?? null,
    auth_required: body.asset?.auth_required ?? false,
    monitoring_tier: body.asset?.monitoring_tier ?? 'P2_monthly',
    verification_status: body.asset?.verification_status ?? 'unverified',
    last_updated_text: body.asset?.last_updated_text ?? null,
    effective_date: body.asset?.effective_date ?? null,
    last_seen_at: body.asset?.last_seen_at ?? null,
    owner_team: body.asset?.owner_team ?? null,
    notes: body.asset?.notes ?? candidate.anchor_text ?? null,
  });
  validateTermsAssetInput(payload);

  const existing = findTermsAssetBySignature(db, payload);
  if (existing) {
    const reviewer = toNullableReviewer(body.reviewer);
    db.prepare(`
      UPDATE terms_asset_candidates
      SET status = 'duplicate',
          promoted_asset_id = ?,
          reviewer = ?,
          reviewed_at = datetime('now','localtime')
      WHERE id = ?
    `).run(existing.id, reviewer, candidateId);

    return c.json({
      candidate: getTermsCandidate(db, candidateId),
      asset: existing,
    });
  }

  const asset = insertTermsAsset(db, payload);
  const reviewer = toNullableReviewer(body.reviewer);

  db.prepare(`
    UPDATE terms_asset_candidates
    SET status = 'promoted',
        promoted_asset_id = ?,
        reviewer = ?,
        reviewed_at = datetime('now','localtime')
    WHERE id = ?
  `).run(asset?.id ?? null, reviewer, candidateId);

  return c.json({
    candidate: getTermsCandidate(db, candidateId),
    asset,
  });
});

termsAssetRoutes.post('/api/terms/candidates/:id/reject', async (c) => {
  const db = getTermsDb();
  const candidateId = Number.parseInt(c.req.param('id'), 10);
  const candidate = getTermsCandidate(db, candidateId);

  if (!candidate) {
    return c.json({ error: '대상 candidate를 찾지 못했습니다.' }, 404);
  }

  const body = await c.req.json<{ reviewer?: string; reason?: string }>().catch(() => ({}));
  db.prepare(`
    UPDATE terms_asset_candidates
    SET status = 'rejected',
        rejected_reason = ?,
        reviewer = ?,
        reviewed_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'manual_reject',
    toNullableReviewer(body.reviewer),
    candidateId,
  );

  return c.json(getTermsCandidate(db, candidateId));
});

termsAssetRoutes.post('/api/terms/assets/discover', async (c) => {
  const db = getTermsDb();
  const body = await c.req.json<{ asset_id?: number }>().catch(() => ({}));

  const singleAsset = body.asset_id ? getTermsAsset(db, Number(body.asset_id)) : null;
  const assets = singleAsset
    ? [singleAsset]
    : listTermsAssets(db).filter((asset) => !asset.auth_required && asset.channel !== 'pdf');

  if (assets.length === 0) {
    const empty: TermsDiscoveryResult = { candidates_added: 0 };
    return c.json(empty);
  }

  const existingUrls = new Set<string>();
  db.prepare('SELECT url FROM terms_assets').all().forEach((row) => {
    if (row && typeof (row as { url?: unknown }).url === 'string') {
      existingUrls.add((row as { url: string }).url);
    }
  });
  db.prepare('SELECT candidate_url FROM terms_asset_candidates').all().forEach((row) => {
    if (row && typeof (row as { candidate_url?: unknown }).candidate_url === 'string') {
      existingUrls.add((row as { candidate_url: string }).candidate_url);
    }
  });

  const discovered = await Promise.all(assets.map((asset) => discoverTermsCandidates(asset, existingUrls, 1)));
  const candidates = discovered.flat();
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO terms_asset_candidates (
      source_url,
      candidate_url,
      anchor_text,
      hint_market_entity,
      hint_service_family,
      hint_document_type,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `);

  let candidatesAdded = 0;
  const tx = db.transaction(() => {
    candidates.forEach((candidate) => {
      const result = insertStmt.run(
        candidate.source_url,
        candidate.candidate_url,
        candidate.anchor_text ?? null,
        candidate.hint_market_entity ?? null,
        candidate.hint_service_family ?? null,
        candidate.hint_document_type ?? null,
      );
      candidatesAdded += result.changes;
    });
  });
  tx();

  return c.json({ candidates_added: candidatesAdded } satisfies TermsDiscoveryResult);
});

function getTermsDb() {
  const db = getDb();
  ensureTermsBootstrap(db);
  return db;
}

function inferChannel(url: string): TermsAssetInput['channel'] {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return 'pdf';
  }
  return 'html';
}

export default termsAssetRoutes;
