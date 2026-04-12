import Database from 'better-sqlite3';
import type { GapReportEntry } from '@/types/terms';

export function buildTermsGapReport(db: Database.Database, marketEntity?: string | null) {
  const rows = db.prepare(`
    SELECT
      am.market_entity,
      am.service_family,
      am.document_type,
      am.requirement,
      am.rationale,
      CASE
        WHEN am.requirement = 'not_applicable' THEN 'na'
        WHEN a.id IS NULL AND am.requirement = 'required' THEN 'missing'
        WHEN a.verification_status = 'broken' THEN 'broken'
        ELSE 'ok'
      END AS status
    FROM terms_applicability am
    LEFT JOIN terms_assets a
      ON a.market_entity = am.market_entity
     AND a.service_family = am.service_family
     AND a.document_type = am.document_type
    WHERE (? IS NULL OR am.market_entity = ?)
    ORDER BY am.market_entity ASC, am.service_family ASC, am.document_type ASC
  `).all(marketEntity ?? null, marketEntity ?? null) as GapReportEntry[];

  return rows;
}
