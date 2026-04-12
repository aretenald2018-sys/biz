import { Hono } from 'hono';
import { getDb } from '@/lib/db';
import type { TermsInboxSummary } from '@/types/terms';
import { ensureTermsBootstrap } from '../lib/terms-db';
import { buildTermsGapReport } from '../lib/terms-gap-detector';

const termsMetaRoutes = new Hono();

termsMetaRoutes.get('/api/terms/gaps', (c) => {
  const db = getTermsDb();
  const marketEntity = c.req.query('market_entity') ?? null;
  return c.json(buildTermsGapReport(db, marketEntity));
});

termsMetaRoutes.get('/api/terms/inbox', (c) => {
  const db = getTermsDb();
  const marketEntity = c.req.query('market_entity') ?? null;
  const gaps = buildTermsGapReport(db, marketEntity).filter((item) => item.status === 'missing' || item.status === 'broken');
  const candidates = db.prepare(`
    SELECT *
    FROM terms_asset_candidates
    WHERE status = 'pending'
    ORDER BY discovered_at DESC, id DESC
  `).all() as Array<{
    candidate_url: string;
    discovered_at: string;
    hint_document_type?: string | null;
    hint_market_entity?: string | null;
    hint_service_family?: string | null;
  }>;
  const changes = db.prepare(`
    SELECT
      dv.id,
      dv.asset_id,
      dv.change_kind,
      dv.captured_at,
      a.market_entity,
      a.service_family,
      a.document_type
    FROM terms_document_versions dv
    JOIN terms_assets a
      ON a.id = dv.asset_id
    WHERE (? IS NULL OR a.market_entity = ?)
      AND dv.change_kind IN ('normalized_change', 'new')
    ORDER BY dv.captured_at DESC, dv.id DESC
  `).all(marketEntity, marketEntity) as Array<{
    asset_id: number;
    captured_at: string;
    change_kind: string;
    document_type: string;
    id: number;
    market_entity: string;
    service_family: string;
  }>;
  const reReview = db.prepare(`
    SELECT
      'processing' AS kind,
      id,
      market_entity,
      taxonomy_code,
      latest_version_id
    FROM terms_processing_facts
    WHERE review_status IN ('re_review_required', 'stale')
      AND (? IS NULL OR market_entity = ?)
    UNION ALL
    SELECT
      'transfer' AS kind,
      id,
      market_entity,
      coalesce(data_taxonomy_code, purpose_taxonomy_code, destination_country) AS taxonomy_code,
      latest_version_id
    FROM terms_transfer_facts
    WHERE review_status IN ('re_review_required', 'stale')
      AND (? IS NULL OR market_entity = ?)
  `).all(marketEntity, marketEntity, marketEntity, marketEntity) as Array<{
    id: number;
    kind: string;
    latest_version_id?: number | null;
    market_entity: string;
    taxonomy_code: string;
  }>;

  const summary: TermsInboxSummary = {
    changes: changes.length,
    gaps: gaps.length,
    re_review: reReview.length,
    candidates: candidates.length,
    items: [
      ...candidates.slice(0, 6).map((item) => ({
        type: 'candidate' as const,
        title: item.hint_document_type ? `Candidate: ${item.hint_document_type}` : 'Candidate: new link',
        summary: [item.hint_market_entity, item.hint_service_family, item.candidate_url].filter(Boolean).join(' / '),
        href: '/terms/candidates',
      })),
      ...gaps.slice(0, 6).map((item) => ({
        type: 'gap' as const,
        title: `Gap: ${item.market_entity} ${item.service_family}`,
        summary: `${item.document_type} / ${item.status}`,
        href: '/terms/assets',
      })),
      ...changes.slice(0, 6).map((item) => ({
        type: 'change' as const,
        title: `Changed: ${item.market_entity} ${item.service_family}`,
        summary: `${item.document_type} / ${item.change_kind} / ${item.captured_at}`,
        href: `/terms/documents/${item.asset_id}`,
      })),
      ...reReview.slice(0, 6).map((item) => ({
        type: 're_review' as const,
        title: `Re-review: ${item.market_entity}`,
        summary: `${item.kind} / ${item.taxonomy_code}`,
        href: item.latest_version_id ? `/terms/review?version=${item.latest_version_id}` : '/terms/review',
      })),
    ].slice(0, 20),
  };

  return c.json(summary);
});

function getTermsDb() {
  const db = getDb();
  ensureTermsBootstrap(db);
  return db;
}

export default termsMetaRoutes;
