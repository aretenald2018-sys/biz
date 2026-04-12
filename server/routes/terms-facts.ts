import { Hono } from 'hono';
import { getDb } from '@/lib/db';
import type {
  TermsBoardCard,
  TermsBoardCardDetail,
  TermsBoardColumnKey,
  TermsBoardResponse,
  TermsFactType,
  TermsProcessingFact,
  TermsReviewProcessingItem,
  TermsReviewQueueResponse,
  TermsReviewTransferItem,
  TermsTransferFact,
} from '@/types/terms';
import {
  buildTermsDocumentDiff,
  deleteExistingVersionFacts,
  ensureTermsBootstrap,
  getTermsAsset,
  getTermsVersion,
  listTermsClauses,
  listTermsEvidence,
  mapTermsVersionRow,
} from '../lib/terms-db';
import { extractTermsFacts, getProcessingDisplayLabel } from '../lib/terms-extractor';

const termsFactRoutes = new Hono();

termsFactRoutes.get('/api/terms/review', (c) => buildReviewResponse(c.req.query('market_entity') ?? null));
termsFactRoutes.post('/api/terms/facts/extract/:versionId', async (c) => {
  const db = getTermsDb();
  const versionId = Number.parseInt(c.req.param('versionId'), 10);
  const version = getTermsVersion(db, versionId);

  if (!version) {
    return c.json({ error: '대상 버전을 찾지 못했습니다.' }, 404);
  }

  const asset = getTermsAsset(db, version.asset_id);
  if (!asset) {
    return c.json({ error: '연결된 asset을 찾지 못했습니다.' }, 404);
  }

  const clauses = listTermsClauses(db, versionId);
  if (clauses.length === 0) {
    return c.json({ error: '분석할 clause가 없습니다.' }, 400);
  }

  const extracted = await extractTermsFacts({
    market_entity: asset.market_entity,
    controller_entity: asset.controller_entity ?? null,
    service_family: asset.service_family,
    clauses,
  });

  const clauseIds = new Map<number, number>();
  clauses.forEach((clause) => {
    clauseIds.set(clause.order_index, clause.id);
  });

  const persist = db.transaction(() => {
    deleteExistingVersionFacts(db, versionId);

    const insertProcessing = db.prepare(`
      INSERT INTO terms_processing_facts (
        market_entity,
        controller_entity,
        service_family,
        category,
        taxonomy_code,
        display_label,
        condition,
        confidence,
        review_status,
        latest_version_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `);
    const insertTransfer = db.prepare(`
      INSERT INTO terms_transfer_facts (
        market_entity,
        controller_entity,
        service_family,
        data_taxonomy_code,
        purpose_taxonomy_code,
        destination_country,
        recipient_entity,
        transfer_mechanism,
        legal_basis,
        status,
        condition,
        confidence,
        review_status,
        latest_version_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `);
    const insertEvidence = db.prepare(`
      INSERT OR IGNORE INTO terms_fact_evidence (fact_type, fact_id, clause_id, excerpt)
      VALUES (?, ?, ?, ?)
    `);

    extracted.processing_facts.forEach((fact) => {
      const result = insertProcessing.run(
        asset.market_entity,
        asset.controller_entity ?? null,
        asset.service_family,
        fact.category,
        fact.taxonomy_code,
        getProcessingDisplayLabel(fact.category, fact.taxonomy_code),
        fact.condition ?? null,
        fact.confidence,
        versionId,
      );
      const factId = Number(result.lastInsertRowid);

      fact.evidence.forEach((evidence) => {
        const clauseId = clauseIds.get(evidence.order_index);
        if (!clauseId) {
          return;
        }
        insertEvidence.run('processing', factId, clauseId, evidence.excerpt ?? null);
      });
    });

    extracted.transfer_facts.forEach((fact) => {
      const result = insertTransfer.run(
        asset.market_entity,
        asset.controller_entity ?? null,
        asset.service_family,
        fact.data_taxonomy_code ?? null,
        fact.purpose_taxonomy_code ?? null,
        fact.destination_country,
        fact.recipient_entity ?? null,
        fact.transfer_mechanism ?? null,
        fact.legal_basis ?? null,
        fact.status,
        fact.condition ?? null,
        fact.confidence,
        versionId,
      );
      const factId = Number(result.lastInsertRowid);

      fact.evidence.forEach((evidence) => {
        const clauseId = clauseIds.get(evidence.order_index);
        if (!clauseId) {
          return;
        }
        insertEvidence.run('transfer', factId, clauseId, evidence.excerpt ?? null);
      });
    });
  });
  persist();

  return c.json({
    processing: extracted.processing_facts.length,
    transfer: extracted.transfer_facts.length,
  });
});

termsFactRoutes.get('/api/terms/facts/review', (c) => {
  return buildReviewResponse(c.req.query('market_entity') ?? null);
});

termsFactRoutes.post('/api/terms/facts/:type/:id/approve', async (c) => {
  const db = getTermsDb();
  const factType = parseFactType(c.req.param('type'));
  const factId = Number.parseInt(c.req.param('id'), 10);

  if (!factType) {
    return c.json({ error: '지원하지 않는 fact type입니다.' }, 400);
  }

  const body = await c.req.json<{ reviewer?: string }>().catch(() => ({}));
  const updated = updateFactReview(db, factType, factId, 'approved', normalizeReviewer(body.reviewer));

  if (!updated) {
    return c.json({ error: '대상 fact를 찾지 못했습니다.' }, 404);
  }

  return c.json(updated);
});

termsFactRoutes.post('/api/terms/facts/:type/:id/reject', async (c) => {
  const db = getTermsDb();
  const factType = parseFactType(c.req.param('type'));
  const factId = Number.parseInt(c.req.param('id'), 10);

  if (!factType) {
    return c.json({ error: '지원하지 않는 fact type입니다.' }, 400);
  }

  const body = await c.req.json<{ reviewer?: string }>().catch(() => ({}));
  const updated = updateFactReview(db, factType, factId, 'rejected', normalizeReviewer(body.reviewer));

  if (!updated) {
    return c.json({ error: '대상 fact를 찾지 못했습니다.' }, 404);
  }

  return c.json(updated);
});

termsFactRoutes.get('/api/terms/board', (c) => buildBoardResponse(c.req.query('market_entity') ?? null));
termsFactRoutes.get('/api/terms/facts/board', (c) => {
  return buildBoardResponse(c.req.query('market_entity') ?? null);
});

function buildBoardResponse(marketEntity: string | null) {
  const db = getTermsDb();

  const columns: TermsBoardResponse['columns'] = {
    collectible_data: [],
    collection_purpose: [],
    transfer_purpose: [],
    korea_transfer: [],
  };
  const details: TermsBoardResponse['details'] = {};

  const processingRows = db.prepare(`
    SELECT
      pf.*,
      me.display_name AS market_entity_display,
      tc.legal_name AS controller_name,
      a.id AS source_asset_id,
      a.document_type AS source_document_type,
      a.url AS source_asset_url,
      (
        SELECT COUNT(*)
        FROM terms_fact_evidence e
        WHERE e.fact_type = 'processing'
          AND e.fact_id = pf.id
      ) AS evidence_count
    FROM terms_processing_facts pf
    LEFT JOIN terms_market_entities me
      ON me.code = pf.market_entity
    LEFT JOIN terms_controllers tc
      ON tc.code = pf.controller_entity
    LEFT JOIN terms_document_versions v
      ON v.id = pf.latest_version_id
    LEFT JOIN terms_assets a
      ON a.id = v.asset_id
    WHERE (? IS NULL OR pf.market_entity = ?)
      AND pf.review_status <> 'rejected'
      AND (ifnull(pf.confidence, 0) >= 0.5 OR pf.manual_entry = 1)
    ORDER BY pf.category ASC, pf.review_status ASC, pf.created_at DESC, pf.id DESC
  `).all(marketEntity, marketEntity) as Array<TermsProcessingFact & {
    controller_name?: string | null;
    evidence_count: number;
    market_entity_display?: string | null;
    source_asset_id?: number | null;
    source_document_type?: string | null;
    source_asset_url?: string | null;
  }>;

  processingRows.forEach((row) => {
    const card = buildProcessingBoardCard(row);
    columns[row.category as Exclude<TermsBoardColumnKey, 'korea_transfer'>].push(card);
    details[`processing:${row.id}`] = buildProcessingBoardDetail(db, row);
  });

  const transferRows = db.prepare(`
    SELECT
      tf.*,
      me.display_name AS market_entity_display,
      tc.legal_name AS controller_name,
      a.id AS source_asset_id,
      a.document_type AS source_document_type,
      a.url AS source_asset_url,
      (
        SELECT COUNT(*)
        FROM terms_fact_evidence e
        WHERE e.fact_type = 'transfer'
          AND e.fact_id = tf.id
      ) AS evidence_count
    FROM terms_transfer_facts tf
    LEFT JOIN terms_market_entities me
      ON me.code = tf.market_entity
    LEFT JOIN terms_controllers tc
      ON tc.code = tf.controller_entity
    LEFT JOIN terms_document_versions v
      ON v.id = tf.latest_version_id
    LEFT JOIN terms_assets a
      ON a.id = v.asset_id
    WHERE (? IS NULL OR tf.market_entity = ?)
      AND tf.review_status <> 'rejected'
      AND (ifnull(tf.confidence, 0) >= 0.5 OR tf.manual_entry = 1)
      AND tf.destination_country = 'KR'
    ORDER BY tf.review_status ASC, tf.created_at DESC, tf.id DESC
  `).all(marketEntity, marketEntity) as Array<TermsTransferFact & {
    controller_name?: string | null;
    evidence_count: number;
    market_entity_display?: string | null;
    source_asset_id?: number | null;
    source_document_type?: string | null;
    source_asset_url?: string | null;
  }>;

  transferRows.forEach((row) => {
    const card = buildTransferBoardCard(row);
    columns.korea_transfer.push(card);
    details[`transfer:${row.id}`] = buildTransferBoardDetail(db, row);
  });

  return new Response(JSON.stringify({ columns, details } satisfies TermsBoardResponse), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function buildReviewResponse(marketEntity: string | null) {
  const db = getTermsDb();
  const response: TermsReviewQueueResponse = {
    processing: getProcessingReviewItems(db, marketEntity),
    transfer: getTransferReviewItems(db, marketEntity),
  };

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function getProcessingReviewItems(db: ReturnType<typeof getDb>, marketEntity: string | null) {
  const rows = db.prepare(`
    SELECT
      pf.*,
      me.display_name AS market_entity_display,
      tc.legal_name AS controller_name
    FROM terms_processing_facts pf
    LEFT JOIN terms_market_entities me
      ON me.code = pf.market_entity
    LEFT JOIN terms_controllers tc
      ON tc.code = pf.controller_entity
    WHERE (? IS NULL OR pf.market_entity = ?)
      AND pf.review_status IN ('pending', 're_review_required', 'stale')
    ORDER BY pf.review_status DESC, pf.created_at DESC, pf.id DESC
  `).all(marketEntity, marketEntity) as Array<TermsProcessingFact & {
    controller_name?: string | null;
    market_entity_display?: string | null;
  }>;

  return rows.map((row) => {
    const latestVersion = row.latest_version_id ? getVersionRow(db, row.latest_version_id) : null;
    const item: TermsReviewProcessingItem = {
      ...row,
      controller_name: row.controller_name ?? null,
      evidence: listTermsEvidence(db, 'processing', row.id),
      latest_version: latestVersion,
      diff: row.latest_version_id ? buildTermsDocumentDiff(db, row.latest_version_id) : null,
      market_entity_display: row.market_entity_display ?? row.market_entity,
    };
    return item;
  });
}

function getTransferReviewItems(db: ReturnType<typeof getDb>, marketEntity: string | null) {
  const rows = db.prepare(`
    SELECT
      tf.*,
      me.display_name AS market_entity_display,
      tc.legal_name AS controller_name
    FROM terms_transfer_facts tf
    LEFT JOIN terms_market_entities me
      ON me.code = tf.market_entity
    LEFT JOIN terms_controllers tc
      ON tc.code = tf.controller_entity
    WHERE (? IS NULL OR tf.market_entity = ?)
      AND tf.review_status IN ('pending', 're_review_required', 'stale')
    ORDER BY tf.review_status DESC, tf.created_at DESC, tf.id DESC
  `).all(marketEntity, marketEntity) as Array<TermsTransferFact & {
    controller_name?: string | null;
    market_entity_display?: string | null;
  }>;

  return rows.map((row) => {
    const latestVersion = row.latest_version_id ? getVersionRow(db, row.latest_version_id) : null;
    const item: TermsReviewTransferItem = {
      ...row,
      controller_name: row.controller_name ?? null,
      evidence: listTermsEvidence(db, 'transfer', row.id),
      latest_version: latestVersion,
      diff: row.latest_version_id ? buildTermsDocumentDiff(db, row.latest_version_id) : null,
      market_entity_display: row.market_entity_display ?? row.market_entity,
    };
    return item;
  });
}

type BoardCardRowExtras = {
  evidence_count: number;
  source_asset_id?: number | null;
  source_document_type?: string | null;
  source_asset_url?: string | null;
};

function buildProcessingBoardCard(row: TermsProcessingFact & BoardCardRowExtras): TermsBoardCard {
  return {
    id: row.id,
    kind: 'processing',
    taxonomy_code: row.taxonomy_code,
    display_label: row.display_label ?? getProcessingDisplayLabel(row.category, row.taxonomy_code),
    condition: row.condition ?? null,
    transfer_status: null,
    review_status: row.review_status,
    evidence_count: row.evidence_count,
    service_family: row.service_family,
    latest_version_id: row.latest_version_id ?? null,
    confidence: row.confidence ?? null,
    manual_entry: Boolean(row.manual_entry),
    source_asset_id: row.source_asset_id ?? null,
    source_document_type: (row.source_document_type ?? null) as TermsBoardCard['source_document_type'],
    source_asset_url: row.source_asset_url ?? null,
  };
}

function buildTransferBoardCard(row: TermsTransferFact & BoardCardRowExtras): TermsBoardCard {
  return {
    id: row.id,
    kind: 'transfer',
    taxonomy_code: row.data_taxonomy_code ?? row.purpose_taxonomy_code ?? 'transfer.korea',
    display_label: formatTransferDisplayLabel(row),
    condition: row.condition ?? null,
    transfer_status: row.status,
    review_status: row.review_status,
    evidence_count: row.evidence_count,
    service_family: row.service_family,
    latest_version_id: row.latest_version_id ?? null,
    confidence: row.confidence ?? null,
    manual_entry: Boolean(row.manual_entry),
    source_asset_id: row.source_asset_id ?? null,
    source_document_type: (row.source_document_type ?? null) as TermsBoardCard['source_document_type'],
    source_asset_url: row.source_asset_url ?? null,
  };
}

function buildProcessingBoardDetail(
  db: ReturnType<typeof getDb>,
  row: TermsProcessingFact,
): TermsBoardCardDetail {
  const evidence = listTermsEvidence(db, 'processing', row.id);
  return {
    ...buildProcessingBoardCard({
      ...row,
      evidence_count: evidence.length,
    }),
    market_entity: row.market_entity,
    controller_entity: row.controller_entity ?? null,
    destination_country: null,
    recipient_entity: null,
    transfer_mechanism: null,
    legal_basis: null,
    confidence: row.confidence ?? null,
    reviewer: row.reviewer ?? null,
    reviewed_at: row.reviewed_at ?? null,
    evidence,
    diff: row.latest_version_id ? buildTermsDocumentDiff(db, row.latest_version_id) : null,
  };
}

function buildTransferBoardDetail(
  db: ReturnType<typeof getDb>,
  row: TermsTransferFact,
): TermsBoardCardDetail {
  const evidence = listTermsEvidence(db, 'transfer', row.id);
  return {
    ...buildTransferBoardCard({
      ...row,
      evidence_count: evidence.length,
    }),
    market_entity: row.market_entity,
    controller_entity: row.controller_entity ?? null,
    destination_country: row.destination_country,
    recipient_entity: row.recipient_entity ?? null,
    transfer_mechanism: row.transfer_mechanism ?? null,
    legal_basis: row.legal_basis ?? null,
    confidence: row.confidence ?? null,
    reviewer: row.reviewer ?? null,
    reviewed_at: row.reviewed_at ?? null,
    evidence,
    diff: row.latest_version_id ? buildTermsDocumentDiff(db, row.latest_version_id) : null,
  };
}

function updateFactReview(
  db: ReturnType<typeof getDb>,
  factType: TermsFactType,
  factId: number,
  status: 'approved' | 'rejected',
  reviewer: string | null,
) {
  const table = factType === 'processing' ? 'terms_processing_facts' : 'terms_transfer_facts';
  const result = db.prepare(`
    UPDATE ${table}
    SET review_status = ?,
        reviewer = ?,
        reviewed_at = datetime('now','localtime')
    WHERE id = ?
  `).run(status, reviewer, factId);

  if (result.changes === 0) {
    return null;
  }

  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(factId);
}

function getVersionRow(db: ReturnType<typeof getDb>, versionId: number) {
  const row = db.prepare('SELECT * FROM terms_document_versions WHERE id = ?').get(versionId);
  return row ? mapTermsVersionRow(row as Parameters<typeof mapTermsVersionRow>[0]) : null;
}

function parseFactType(value: string): TermsFactType | null {
  if (value === 'processing' || value === 'transfer') {
    return value;
  }
  return null;
}

function normalizeReviewer(value?: string) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function formatTransferDisplayLabel(row: TermsTransferFact) {
  const parts = [row.destination_country];
  if (row.recipient_entity) {
    parts.push(row.recipient_entity);
  }
  if (row.purpose_taxonomy_code) {
    parts.push(row.purpose_taxonomy_code);
  }
  return parts.join(' / ');
}

function getTermsDb() {
  const db = getDb();
  ensureTermsBootstrap(db);
  return db;
}

// 특정 document_version 에 속한 pending facts 전체 조회 (미리보기용)
termsFactRoutes.get('/api/terms/facts/by-version/:versionId', (c) => {
  const db = getTermsDb();
  const versionId = Number.parseInt(c.req.param('versionId'), 10);
  if (!Number.isFinite(versionId)) {
    return c.json({ error: '잘못된 version id' }, 400);
  }
  const processing = db.prepare(`
    SELECT pf.*, me.display_name AS market_entity_display
      FROM terms_processing_facts pf
      LEFT JOIN terms_market_entities me ON me.code = pf.market_entity
     WHERE pf.latest_version_id = ?
  `).all(versionId);
  const transfer = db.prepare(`
    SELECT tf.*, me.display_name AS market_entity_display
      FROM terms_transfer_facts tf
      LEFT JOIN terms_market_entities me ON me.code = tf.market_entity
     WHERE tf.latest_version_id = ?
  `).all(versionId);
  return c.json({ processing, transfer });
});

// 미리보기 확정: 선택된 fact 는 approved + manual_entry 승격, 나머지는 삭제.
termsFactRoutes.post('/api/terms/facts/commit-selection', async (c) => {
  const db = getTermsDb();
  const body = (await c.req.json().catch(() => ({}))) as {
    version_id?: number;
    approvals?: Array<{ kind: 'processing' | 'transfer'; id: number; display_label?: string; status?: string }>;
  };

  if (!body.version_id) {
    return c.json({ error: 'version_id 필요' }, 400);
  }

  const approvals = body.approvals ?? [];
  const keepProcessing = new Set<number>();
  const keepTransfer = new Set<number>();
  for (const a of approvals) {
    if (a.kind === 'processing') keepProcessing.add(a.id);
    else if (a.kind === 'transfer') keepTransfer.add(a.id);
  }

  const tx = db.transaction(() => {
    // 편집된 라벨/상태 반영 + manual_entry 로 승격
    for (const a of approvals) {
      if (a.kind === 'processing') {
        db.prepare(`
          UPDATE terms_processing_facts
             SET review_status = 'approved',
                 reviewer = COALESCE(reviewer, 'manual'),
                 reviewed_at = datetime('now','localtime'),
                 manual_entry = 1,
                 display_label = COALESCE(?, display_label)
           WHERE id = ?
        `).run(a.display_label ?? null, a.id);
      } else {
        db.prepare(`
          UPDATE terms_transfer_facts
             SET review_status = 'approved',
                 reviewer = COALESCE(reviewer, 'manual'),
                 reviewed_at = datetime('now','localtime'),
                 manual_entry = 1,
                 status = COALESCE(?, status)
           WHERE id = ?
        `).run(a.status ?? null, a.id);
      }
    }

    // 선택 안 된 나머지는 DELETE (evidence CASCADE 는 안 되므로 수동 삭제)
    const rejProcessing = db.prepare(`
      SELECT id FROM terms_processing_facts WHERE latest_version_id = ?
    `).all(body.version_id!) as Array<{ id: number }>;
    for (const row of rejProcessing) {
      if (keepProcessing.has(row.id)) continue;
      db.prepare('DELETE FROM terms_fact_evidence WHERE fact_type=? AND fact_id=?').run('processing', row.id);
      db.prepare('DELETE FROM terms_processing_facts WHERE id=?').run(row.id);
    }
    const rejTransfer = db.prepare(`
      SELECT id FROM terms_transfer_facts WHERE latest_version_id = ?
    `).all(body.version_id!) as Array<{ id: number }>;
    for (const row of rejTransfer) {
      if (keepTransfer.has(row.id)) continue;
      db.prepare('DELETE FROM terms_fact_evidence WHERE fact_type=? AND fact_id=?').run('transfer', row.id);
      db.prepare('DELETE FROM terms_transfer_facts WHERE id=?').run(row.id);
    }
  });
  tx();

  return c.json({ approved: approvals.length });
});

// 보드에서 수동 fact 추가 (자산/버전 없이 바로 생성)
termsFactRoutes.post('/api/terms/facts/manual', async (c) => {
  const db = getTermsDb();
  const body = (await c.req.json().catch(() => null)) as {
    market_entity?: string;
    column?: 'collectible_data' | 'collection_purpose' | 'transfer_purpose' | 'korea_transfer';
    display_label?: string;
    service_family?: string;
    condition?: string;
    status?: 'allowed' | 'conditional' | 'unclear' | 'not_allowed';
  } | null;

  if (!body?.market_entity || !body?.display_label || !body?.column) {
    return c.json({ error: 'market_entity / column / display_label 이 필요합니다.' }, 400);
  }

  const entity = db.prepare('SELECT controller_entity FROM (SELECT NULL AS controller_entity) WHERE 1=0').get();
  void entity;

  const service = body.service_family ?? 'website';
  const taxonomy = `manual.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;

  if (body.column === 'korea_transfer') {
    const result = db.prepare(`
      INSERT INTO terms_transfer_facts (
        market_entity, controller_entity, service_family,
        data_taxonomy_code, purpose_taxonomy_code,
        destination_country, recipient_entity, transfer_mechanism, legal_basis,
        status, condition, confidence,
        review_status, reviewer, reviewed_at, manual_entry
      )
      VALUES (?, NULL, ?, ?, NULL, 'KR', NULL, NULL, NULL, ?, ?, NULL, 'approved', 'manual', datetime('now','localtime'), 1)
    `).run(body.market_entity, service, taxonomy, body.status ?? 'allowed', body.condition ?? null);
    const id = Number(result.lastInsertRowid);
    const row = db.prepare(`
      UPDATE terms_transfer_facts SET display_label = ? WHERE id = ? RETURNING *
    `).get(body.display_label, id) as Record<string, unknown> | undefined;
    void row;
    return c.json({ kind: 'transfer', id, display_label: body.display_label }, 201);
  }

  const category = body.column; // collectible_data | collection_purpose | transfer_purpose
  const result = db.prepare(`
    INSERT INTO terms_processing_facts (
      market_entity, controller_entity, service_family,
      category, taxonomy_code, display_label, condition, confidence,
      review_status, reviewer, reviewed_at, manual_entry
    )
    VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, 'approved', 'manual', datetime('now','localtime'), 1)
  `).run(body.market_entity, service, category, taxonomy, body.display_label, body.condition ?? null);
  const id = Number(result.lastInsertRowid);
  return c.json({ kind: 'processing', id, display_label: body.display_label }, 201);
});

// 수동 fact 수정
termsFactRoutes.patch('/api/terms/facts/:kind/:id', async (c) => {
  const db = getTermsDb();
  const kind = c.req.param('kind');
  const id = Number.parseInt(c.req.param('id'), 10);
  if (kind !== 'processing' && kind !== 'transfer') {
    return c.json({ error: '잘못된 kind' }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as {
    display_label?: string;
    condition?: string;
    status?: string;
  };
  const table = kind === 'processing' ? 'terms_processing_facts' : 'terms_transfer_facts';

  const sets: string[] = [];
  const args: unknown[] = [];
  if (body.display_label !== undefined) { sets.push('display_label = ?'); args.push(body.display_label); }
  if (body.condition !== undefined) { sets.push('condition = ?'); args.push(body.condition); }
  if (kind === 'transfer' && body.status !== undefined) { sets.push('status = ?'); args.push(body.status); }
  if (sets.length === 0) return c.json({ error: '변경할 필드가 없습니다.' }, 400);

  args.push(id);
  const info = db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  if (info.changes === 0) return c.json({ error: '대상 없음' }, 404);
  return c.json({ ok: true });
});

// fact 삭제
termsFactRoutes.delete('/api/terms/facts/:kind/:id', (c) => {
  const db = getTermsDb();
  const kind = c.req.param('kind');
  const id = Number.parseInt(c.req.param('id'), 10);
  if (kind !== 'processing' && kind !== 'transfer') {
    return c.json({ error: '잘못된 kind' }, 400);
  }
  const table = kind === 'processing' ? 'terms_processing_facts' : 'terms_transfer_facts';
  db.prepare('DELETE FROM terms_fact_evidence WHERE fact_type=? AND fact_id=?').run(kind, id);
  const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (info.changes === 0) return c.json({ error: '대상 없음' }, 404);
  return c.json({ ok: true });
});

export default termsFactRoutes;
