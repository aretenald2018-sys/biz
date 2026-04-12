import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type {
  TermsApplicabilityEntry,
  TermsAsset,
  TermsAssetCandidate,
  TermsAssetInput,
  TermsClause,
  TermsDocumentDiff,
  TermsDocumentVersion,
  TermsEvidenceItem,
  TermsFactType,
} from '@/types/terms';
import { readTermsText } from './terms-blob-store';
import { loadTermsApplicability, loadTermsControllers, loadTermsMarketEntities, loadTermsSeedAssets } from './terms-data';
import { diffTexts } from './terms-diff';

const SNAPSHOT_TABLES = [
  'terms_market_entities',
  'terms_controllers',
  'terms_applicability',
  'terms_assets',
  'terms_asset_candidates',
  'terms_document_versions',
  'terms_clauses',
  'terms_processing_facts',
  'terms_transfer_facts',
  'terms_fact_evidence',
] as const;

function importSnapshotIfEmpty(db: Database.Database) {
  const snapshotDir = path.resolve(process.cwd(), 'data', 'terms-snapshot');
  if (!fs.existsSync(snapshotDir)) return;

  // 주요 테이블(assets·facts) 중 하나라도 비어 있으면 import
  const anyEmpty = SNAPSHOT_TABLES.some((table) => {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
    return row.c === 0;
  });
  if (!anyEmpty) return;

  db.pragma('foreign_keys = OFF');
  try {
    db.prepare('DROP TRIGGER IF EXISTS trg_terms_mark_facts_stale').run();
    for (const table of SNAPSHOT_TABLES) {
      const filePath = path.join(snapshotDir, `${table}.json`);
      if (!fs.existsSync(filePath)) continue;
      const rows = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>[];
      if (rows.length === 0) continue;
      const currentCount = (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
      if (currentCount > 0) continue;
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map((c) => `@${c}`).join(',');
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
      );
      const tx = db.transaction((items: Record<string, unknown>[]) => {
        for (const item of items) stmt.run(item as never);
      });
      tx(rows);
    }
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_terms_mark_facts_stale
      AFTER INSERT ON terms_document_versions
      WHEN NEW.change_kind IN ('normalized_change','new')
      BEGIN
        UPDATE terms_processing_facts
           SET review_status = 're_review_required'
         WHERE review_status = 'approved'
           AND latest_version_id IN (
             SELECT id FROM terms_document_versions WHERE asset_id = NEW.asset_id AND id <> NEW.id
           );
        UPDATE terms_transfer_facts
           SET review_status = 're_review_required'
         WHERE review_status = 'approved'
           AND latest_version_id IN (
             SELECT id FROM terms_document_versions WHERE asset_id = NEW.asset_id AND id <> NEW.id
           );
      END
    `);
  } finally {
    db.pragma('foreign_keys = ON');
  }
  console.log('[terms] snapshot imported from data/terms-snapshot');
}

type TermsAssetRow = Omit<TermsAsset, 'auth_required'> & { auth_required: number };
type TermsAssetCandidateRow = TermsAssetCandidate;
type TermsClauseRow = TermsClause;
type TermsDocumentVersionRow = TermsDocumentVersion;

let bootstrapped = false;

export function ensureTermsBootstrap(db: Database.Database) {
  if (bootstrapped) {
    return;
  }

  // git 으로 공유된 terms 스냅샷이 있고 DB 가 비어 있으면 자동 복원
  importSnapshotIfEmpty(db);

  const upsertReferenceData = db.transaction(() => {
    const marketEntityStmt = db.prepare(`
      INSERT INTO terms_market_entities (code, display_name, region, country, brand, owner_team, notes)
      VALUES (@code, @display_name, @region, @country, @brand, @owner_team, @notes)
      ON CONFLICT(code) DO UPDATE SET
        display_name = excluded.display_name,
        region = excluded.region,
        country = excluded.country,
        brand = excluded.brand,
        owner_team = excluded.owner_team,
        notes = excluded.notes
    `);
    const controllerStmt = db.prepare(`
      INSERT INTO terms_controllers (code, legal_name, region, jurisdiction, notes)
      VALUES (@code, @legal_name, @region, @jurisdiction, @notes)
      ON CONFLICT(code) DO UPDATE SET
        legal_name = excluded.legal_name,
        region = excluded.region,
        jurisdiction = excluded.jurisdiction,
        notes = excluded.notes
    `);
    const applicabilityStmt = db.prepare(`
      INSERT INTO terms_applicability (market_entity, service_family, document_type, requirement, rationale)
      VALUES (@market_entity, @service_family, @document_type, @requirement, @rationale)
      ON CONFLICT(market_entity, service_family, document_type) DO UPDATE SET
        requirement = excluded.requirement,
        rationale = excluded.rationale
    `);
    const findAssetStmt = db.prepare(`
      SELECT id
      FROM terms_assets
      WHERE market_entity = ?
        AND service_family = ?
        AND document_type = ?
        AND channel = ?
        AND url = ?
        AND ifnull(language, '') = ifnull(?, '')
      LIMIT 1
    `);
    const insertAssetStmt = db.prepare(`
      INSERT INTO terms_assets (
        market_entity,
        controller_entity,
        service_family,
        document_type,
        channel,
        url,
        language,
        auth_required,
        monitoring_tier,
        verification_status,
        last_updated_text,
        effective_date,
        owner_team,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateAssetStmt = db.prepare(`
      UPDATE terms_assets
      SET controller_entity = ?,
          auth_required = ?,
          monitoring_tier = ?,
          verification_status = ?,
          last_updated_text = ?,
          effective_date = ?,
          owner_team = ?,
          notes = ?,
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `);

    loadTermsMarketEntities().forEach((item) =>
      marketEntityStmt.run({
        code: item.code,
        display_name: item.display_name,
        region: item.region,
        country: item.country,
        brand: item.brand,
        owner_team: item.owner_team ?? null,
        notes: item.notes ?? null,
      }),
    );
    loadTermsControllers().forEach((item) =>
      controllerStmt.run({
        code: item.code,
        legal_name: item.legal_name,
        region: item.region ?? null,
        jurisdiction: item.jurisdiction ?? null,
        notes: item.notes ?? null,
      }),
    );
    loadTermsApplicability().forEach((item) =>
      applicabilityStmt.run({
        market_entity: item.market_entity,
        service_family: item.service_family,
        document_type: item.document_type,
        requirement: item.requirement,
        rationale: item.rationale ?? null,
      }),
    );
    loadTermsSeedAssets().forEach((asset) => {
      const existing = findAssetStmt.get(
        asset.market_entity,
        asset.service_family,
        asset.document_type,
        asset.channel,
        asset.url,
        asset.language ?? null,
      ) as { id: number } | undefined;

      if (existing) {
        updateAssetStmt.run(
          asset.controller_entity ?? null,
          asset.auth_required ? 1 : 0,
          asset.monitoring_tier,
          asset.verification_status,
          asset.last_updated_text ?? null,
          asset.effective_date ?? null,
          asset.owner_team ?? null,
          asset.notes ?? null,
          existing.id,
        );
        return;
      }

      insertAssetStmt.run(
        asset.market_entity,
        asset.controller_entity ?? null,
        asset.service_family,
        asset.document_type,
        asset.channel,
        asset.url,
        asset.language ?? null,
        asset.auth_required ? 1 : 0,
        asset.monitoring_tier,
        asset.verification_status,
        asset.last_updated_text ?? null,
        asset.effective_date ?? null,
        asset.owner_team ?? null,
        asset.notes ?? null,
      );
    });
  });

  upsertReferenceData();
  bootstrapped = true;
}

export function getTermsAsset(db: Database.Database, assetId: number) {
  const row = db.prepare('SELECT * FROM terms_assets WHERE id = ?').get(assetId) as TermsAssetRow | undefined;
  return row ? mapTermsAssetRow(row) : null;
}

export function listTermsAssets(db: Database.Database, filters: {
  market_entity?: string | null;
  service_family?: string | null;
  document_type?: string | null;
  verification_status?: string | null;
} = {}) {
  const rows = db.prepare(`
    SELECT *
    FROM terms_assets
    WHERE (? IS NULL OR market_entity = ?)
      AND (? IS NULL OR service_family = ?)
      AND (? IS NULL OR document_type = ?)
      AND (? IS NULL OR verification_status = ?)
    ORDER BY market_entity ASC, service_family ASC, document_type ASC, updated_at DESC, id DESC
  `).all(
    filters.market_entity ?? null,
    filters.market_entity ?? null,
    filters.service_family ?? null,
    filters.service_family ?? null,
    filters.document_type ?? null,
    filters.document_type ?? null,
    filters.verification_status ?? null,
    filters.verification_status ?? null,
  ) as TermsAssetRow[];

  return rows.map(mapTermsAssetRow);
}

export function insertTermsAsset(db: Database.Database, input: TermsAssetInput) {
  const result = db.prepare(`
    INSERT INTO terms_assets (
      market_entity,
      controller_entity,
      service_family,
      document_type,
      channel,
      url,
      language,
      auth_required,
      monitoring_tier,
      verification_status,
      last_updated_text,
      effective_date,
      last_seen_at,
      owner_team,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.market_entity,
    input.controller_entity ?? null,
    input.service_family,
    input.document_type,
    input.channel,
    input.url,
    input.language ?? null,
    input.auth_required ? 1 : 0,
    input.monitoring_tier,
    input.verification_status,
    input.last_updated_text ?? null,
    input.effective_date ?? null,
    input.last_seen_at ?? null,
    input.owner_team ?? null,
    input.notes ?? null,
  );

  return getTermsAsset(db, Number(result.lastInsertRowid));
}

export function findTermsAssetBySignature(db: Database.Database, input: Pick<
  TermsAssetInput,
  'market_entity' | 'service_family' | 'document_type' | 'channel' | 'url' | 'language'
>) {
  const row = db.prepare(`
    SELECT *
    FROM terms_assets
    WHERE market_entity = ?
      AND service_family = ?
      AND document_type = ?
      AND channel = ?
      AND url = ?
      AND ifnull(language, '') = ifnull(?, '')
    LIMIT 1
  `).get(
    input.market_entity,
    input.service_family,
    input.document_type,
    input.channel,
    input.url,
    input.language ?? null,
  ) as TermsAssetRow | undefined;

  return row ? mapTermsAssetRow(row) : null;
}

export function getTermsVersion(db: Database.Database, versionId: number) {
  const row = db.prepare('SELECT * FROM terms_document_versions WHERE id = ?').get(versionId) as TermsDocumentVersionRow | undefined;
  return row ? mapTermsVersionRow(row) : null;
}

export function getLatestTermsVersion(db: Database.Database, assetId: number) {
  const row = db.prepare(`
    SELECT *
    FROM terms_document_versions
    WHERE asset_id = ?
    ORDER BY captured_at DESC, id DESC
    LIMIT 1
  `).get(assetId) as TermsDocumentVersionRow | undefined;

  return row ? mapTermsVersionRow(row) : null;
}

export function listTermsVersions(db: Database.Database, assetId: number) {
  const rows = db.prepare(`
    SELECT *
    FROM terms_document_versions
    WHERE asset_id = ?
    ORDER BY captured_at DESC, id DESC
  `).all(assetId) as TermsDocumentVersionRow[];

  return rows.map(mapTermsVersionRow);
}

export function listTermsClauses(db: Database.Database, versionId: number) {
  return db.prepare(`
    SELECT *
    FROM terms_clauses
    WHERE version_id = ?
    ORDER BY order_index ASC
  `).all(versionId) as TermsClauseRow[];
}

export function listTermsCandidates(db: Database.Database, status?: string | null) {
  const rows = db.prepare(`
    SELECT *
    FROM terms_asset_candidates
    WHERE (? IS NULL OR status = ?)
    ORDER BY discovered_at DESC, id DESC
  `).all(status ?? null, status ?? null) as TermsAssetCandidateRow[];

  return rows.map(mapTermsCandidateRow);
}

export function getTermsCandidate(db: Database.Database, candidateId: number) {
  const row = db.prepare('SELECT * FROM terms_asset_candidates WHERE id = ?').get(candidateId) as TermsAssetCandidateRow | undefined;
  return row ? mapTermsCandidateRow(row) : null;
}

export function listTermsEvidence(db: Database.Database, factType: TermsFactType, factId: number) {
  return db.prepare(`
    SELECT
      c.id AS clause_id,
      c.order_index,
      c.heading,
      c.path,
      e.excerpt,
      c.body
    FROM terms_fact_evidence e
    JOIN terms_clauses c
      ON c.id = e.clause_id
    WHERE e.fact_type = ?
      AND e.fact_id = ?
    ORDER BY c.order_index ASC
  `).all(factType, factId) as TermsEvidenceItem[];
}

export function deleteExistingVersionFacts(db: Database.Database, versionId: number) {
  db.prepare(`
    DELETE FROM terms_fact_evidence
    WHERE fact_type = 'processing'
      AND fact_id IN (
        SELECT id
        FROM terms_processing_facts
        WHERE latest_version_id = ?
      )
  `).run(versionId);
  db.prepare('DELETE FROM terms_processing_facts WHERE latest_version_id = ?').run(versionId);
  db.prepare(`
    DELETE FROM terms_fact_evidence
    WHERE fact_type = 'transfer'
      AND fact_id IN (
        SELECT id
        FROM terms_transfer_facts
        WHERE latest_version_id = ?
      )
  `).run(versionId);
  db.prepare('DELETE FROM terms_transfer_facts WHERE latest_version_id = ?').run(versionId);
}

export function buildTermsDocumentDiff(db: Database.Database, versionId: number): TermsDocumentDiff | null {
  const version = getTermsVersion(db, versionId);
  if (!version) {
    return null;
  }

  let previous = version.diff_from_prev_id ? getTermsVersion(db, version.diff_from_prev_id) : null;
  if (!previous) {
    previous = getPreviousTermsVersion(db, version.asset_id, version.id);
  }

  if (!previous?.extracted_text_path || !version.extracted_text_path) {
    return null;
  }

  try {
    const leftText = readTermsText(previous.extracted_text_path);
    const rightText = readTermsText(version.extracted_text_path);
    return {
      version_id: version.id,
      prev_id: previous.id,
      segments: diffTexts(leftText, rightText),
    };
  } catch {
    return null;
  }
}

export function mapTermsAssetRow(row: TermsAssetRow): TermsAsset {
  return {
    ...row,
    auth_required: Boolean(row.auth_required),
  };
}

export function mapTermsCandidateRow(row: TermsAssetCandidateRow): TermsAssetCandidate {
  return row;
}

export function mapTermsVersionRow(row: TermsDocumentVersionRow): TermsDocumentVersion {
  return row;
}

export function getPreviousTermsVersion(db: Database.Database, assetId: number, versionId: number) {
  const row = db.prepare(`
    SELECT *
    FROM terms_document_versions
    WHERE asset_id = ?
      AND id < ?
    ORDER BY id DESC
    LIMIT 1
  `).get(assetId, versionId) as TermsDocumentVersionRow | undefined;

  return row ? mapTermsVersionRow(row) : null;
}

export function parseTermsAssetInput(value: Partial<TermsAssetInput>): TermsAssetInput {
  return {
    market_entity: String(value.market_entity ?? '').trim(),
    controller_entity: value.controller_entity ? String(value.controller_entity).trim() : null,
    service_family: String(value.service_family ?? '').trim() as TermsAssetInput['service_family'],
    document_type: String(value.document_type ?? '').trim() as TermsAssetInput['document_type'],
    channel: String(value.channel ?? '').trim() as TermsAssetInput['channel'],
    url: String(value.url ?? '').trim(),
    language: value.language ? String(value.language).trim() : null,
    auth_required: Boolean(value.auth_required),
    monitoring_tier: String(value.monitoring_tier ?? 'P2_monthly').trim() as TermsAssetInput['monitoring_tier'],
    verification_status: String(value.verification_status ?? 'unverified').trim() as TermsAssetInput['verification_status'],
    last_updated_text: value.last_updated_text ? String(value.last_updated_text).trim() : null,
    effective_date: value.effective_date ? String(value.effective_date).trim() : null,
    last_seen_at: value.last_seen_at ? String(value.last_seen_at).trim() : null,
    owner_team: value.owner_team ? String(value.owner_team).trim() : null,
    notes: value.notes ? String(value.notes).trim() : null,
  };
}

export function validateTermsAssetInput(input: TermsAssetInput) {
  if (!input.market_entity || !input.service_family || !input.document_type || !input.channel || !input.url) {
    throw new Error('필수 asset 필드가 비어 있습니다.');
  }

  try {
    new URL(input.url);
  } catch {
    throw new Error('유효한 URL이 아닙니다.');
  }
}

export function toNullableReviewer(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeApplicabilityEntry(value: TermsApplicabilityEntry) {
  return {
    ...value,
    rationale: value.rationale ?? null,
  };
}
