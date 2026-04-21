import type Database from 'better-sqlite3';
import type {
  KdpBrand,
  KdpCategory,
  KdpChunk,
  KdpDiffEntry,
  KdpModal,
  KdpPolicy,
  KdpQaLog,
  KdpSection,
  KdpSourceMode,
} from '@/types/kdp';

let bootstrapped = false;

export function ensureKdpBootstrap(db: Database.Database) {
  if (bootstrapped) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS kdp_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_mode TEXT NOT NULL DEFAULT 'fetch',
      fetched_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      title TEXT,
      version_hash TEXT NOT NULL,
      raw_html BLOB,
      plain_text TEXT NOT NULL DEFAULT '',
      is_current INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_kdp_policies_brand_current ON kdp_policies(brand, is_current);

    CREATE TABLE IF NOT EXISTS kdp_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES kdp_policies(id) ON DELETE CASCADE,
      parent_id INTEGER,
      order_idx INTEGER NOT NULL DEFAULT 0,
      heading_level INTEGER NOT NULL DEFAULT 2,
      heading TEXT NOT NULL,
      anchor_slug TEXT NOT NULL DEFAULT '',
      path_text TEXT,
      category TEXT NOT NULL DEFAULT 'other',
      text TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_kdp_sections_policy ON kdp_sections(policy_id, order_idx);

    CREATE TABLE IF NOT EXISTS kdp_modals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES kdp_policies(id) ON DELETE CASCADE,
      link_key TEXT NOT NULL,
      label TEXT NOT NULL,
      title TEXT,
      html TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      anchored_section_id INTEGER,
      category TEXT NOT NULL DEFAULT 'other'
    );
    CREATE INDEX IF NOT EXISTS idx_kdp_modals_policy ON kdp_modals(policy_id);

    CREATE TABLE IF NOT EXISTS kdp_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES kdp_policies(id) ON DELETE CASCADE,
      section_id INTEGER,
      modal_id INTEGER,
      ord INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      heading_path TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_kdp_chunks_policy ON kdp_chunks(policy_id);
    CREATE INDEX IF NOT EXISTS idx_kdp_chunks_section ON kdp_chunks(section_id);
    CREATE INDEX IF NOT EXISTS idx_kdp_chunks_modal ON kdp_chunks(modal_id);

    CREATE TABLE IF NOT EXISTS kdp_qa_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES kdp_policies(id) ON DELETE CASCADE,
      brand TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      citations_json TEXT NOT NULL DEFAULT '[]',
      model TEXT NOT NULL,
      category TEXT,
      starred INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_kdp_qa_logs_brand ON kdp_qa_logs(brand, created_at DESC);

    CREATE TABLE IF NOT EXISTS kdp_diffs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      from_policy_id INTEGER,
      to_policy_id INTEGER NOT NULL REFERENCES kdp_policies(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      summary_json TEXT NOT NULL DEFAULT '{}',
      full_diff TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_kdp_diffs_brand ON kdp_diffs(brand, created_at DESC);
  `);

  bootstrapped = true;
}

type PolicyRow = {
  id: number;
  brand: string;
  source_url: string;
  source_mode: string;
  fetched_at: string;
  title: string | null;
  version_hash: string;
  plain_text: string;
  is_current: number;
};

export function mapPolicyRow(row: PolicyRow): KdpPolicy {
  return {
    id: row.id,
    brand: row.brand as KdpBrand,
    source_url: row.source_url,
    source_mode: row.source_mode as KdpSourceMode,
    fetched_at: row.fetched_at,
    title: row.title,
    version_hash: row.version_hash,
    plain_text_len: row.plain_text?.length ?? 0,
  };
}

export function getCurrentPolicy(db: Database.Database, brand: KdpBrand): KdpPolicy | null {
  const row = db
    .prepare(
      `SELECT id, brand, source_url, source_mode, fetched_at, title, version_hash, plain_text, is_current
       FROM kdp_policies
       WHERE brand = ? AND is_current = 1
       ORDER BY fetched_at DESC
       LIMIT 1`,
    )
    .get(brand) as PolicyRow | undefined;
  return row ? mapPolicyRow(row) : null;
}

export function getPolicyById(db: Database.Database, id: number): KdpPolicy | null {
  const row = db
    .prepare(
      `SELECT id, brand, source_url, source_mode, fetched_at, title, version_hash, plain_text, is_current
       FROM kdp_policies
       WHERE id = ?`,
    )
    .get(id) as PolicyRow | undefined;
  return row ? mapPolicyRow(row) : null;
}

export function getPolicyPlainText(db: Database.Database, id: number): string {
  const row = db.prepare('SELECT plain_text FROM kdp_policies WHERE id = ?').get(id) as
    | { plain_text: string }
    | undefined;
  return row?.plain_text ?? '';
}

export function listSections(db: Database.Database, policyId: number): KdpSection[] {
  return db
    .prepare(
      `SELECT id, policy_id, parent_id, order_idx, heading_level, heading, anchor_slug, path_text, category, text
       FROM kdp_sections WHERE policy_id = ? ORDER BY order_idx ASC, id ASC`,
    )
    .all(policyId) as KdpSection[];
}

export function listModals(db: Database.Database, policyId: number): KdpModal[] {
  return db
    .prepare(
      `SELECT id, policy_id, link_key, label, title, html, text, anchored_section_id, category
       FROM kdp_modals WHERE policy_id = ? ORDER BY id ASC`,
    )
    .all(policyId) as KdpModal[];
}

export function listChunks(db: Database.Database, policyId: number): KdpChunk[] {
  return db
    .prepare(
      `SELECT id, policy_id, section_id, modal_id, ord, text, category, heading_path
       FROM kdp_chunks WHERE policy_id = ? ORDER BY ord ASC, id ASC`,
    )
    .all(policyId) as KdpChunk[];
}

export interface CreatePolicyInput {
  brand: KdpBrand;
  source_url: string;
  source_mode: KdpSourceMode;
  title?: string | null;
  version_hash: string;
  plain_text: string;
  raw_html?: Buffer | null;
}

export function insertPolicy(db: Database.Database, input: CreatePolicyInput): number {
  const result = db
    .prepare(
      `INSERT INTO kdp_policies (brand, source_url, source_mode, title, version_hash, plain_text, raw_html, is_current)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .run(
      input.brand,
      input.source_url,
      input.source_mode,
      input.title ?? null,
      input.version_hash,
      input.plain_text,
      input.raw_html ?? null,
    );
  return Number(result.lastInsertRowid);
}

export function markOtherPoliciesStale(db: Database.Database, brand: KdpBrand, keepId: number) {
  db.prepare('UPDATE kdp_policies SET is_current = 0 WHERE brand = ? AND id <> ?').run(brand, keepId);
}

export interface InsertSectionRow {
  parent_id: number | null;
  order_idx: number;
  heading_level: number;
  heading: string;
  anchor_slug: string;
  path_text: string | null;
  category: KdpCategory;
  text: string;
}

export function insertSections(db: Database.Database, policyId: number, rows: InsertSectionRow[]): number[] {
  const stmt = db.prepare(
    `INSERT INTO kdp_sections (policy_id, parent_id, order_idx, heading_level, heading, anchor_slug, path_text, category, text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ids: number[] = [];
  const tx = db.transaction(() => {
    rows.forEach((r) => {
      const res = stmt.run(
        policyId,
        r.parent_id,
        r.order_idx,
        r.heading_level,
        r.heading,
        r.anchor_slug,
        r.path_text,
        r.category,
        r.text,
      );
      ids.push(Number(res.lastInsertRowid));
    });
  });
  tx();
  return ids;
}

export interface InsertModalRow {
  link_key: string;
  label: string;
  title: string | null;
  html: string;
  text: string;
  anchored_section_id: number | null;
  category: KdpCategory;
}

export function insertModals(db: Database.Database, policyId: number, rows: InsertModalRow[]): number[] {
  const stmt = db.prepare(
    `INSERT INTO kdp_modals (policy_id, link_key, label, title, html, text, anchored_section_id, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ids: number[] = [];
  const tx = db.transaction(() => {
    rows.forEach((r) => {
      const res = stmt.run(
        policyId,
        r.link_key,
        r.label,
        r.title,
        r.html,
        r.text,
        r.anchored_section_id,
        r.category,
      );
      ids.push(Number(res.lastInsertRowid));
    });
  });
  tx();
  return ids;
}

export interface InsertChunkRow {
  section_id: number | null;
  modal_id: number | null;
  ord: number;
  text: string;
  category: KdpCategory;
  heading_path: string | null;
}

export function insertChunks(db: Database.Database, policyId: number, rows: InsertChunkRow[]) {
  const stmt = db.prepare(
    `INSERT INTO kdp_chunks (policy_id, section_id, modal_id, ord, text, category, heading_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    rows.forEach((r) => {
      stmt.run(policyId, r.section_id, r.modal_id, r.ord, r.text, r.category, r.heading_path);
    });
  });
  tx();
}

export function deletePolicyData(db: Database.Database, policyId: number) {
  db.prepare('DELETE FROM kdp_chunks WHERE policy_id = ?').run(policyId);
  db.prepare('DELETE FROM kdp_modals WHERE policy_id = ?').run(policyId);
  db.prepare('DELETE FROM kdp_sections WHERE policy_id = ?').run(policyId);
}

export function deletePolicy(db: Database.Database, policyId: number) {
  db.prepare('DELETE FROM kdp_policies WHERE id = ?').run(policyId);
}

export function updateSection(
  db: Database.Database,
  sectionId: number,
  patch: Partial<InsertSectionRow>,
) {
  const current = db.prepare('SELECT * FROM kdp_sections WHERE id = ?').get(sectionId) as
    | (InsertSectionRow & { policy_id: number })
    | undefined;
  if (!current) return null;
  const next = { ...current, ...patch };
  db.prepare(
    `UPDATE kdp_sections
     SET parent_id = ?, order_idx = ?, heading_level = ?, heading = ?, anchor_slug = ?, path_text = ?, category = ?, text = ?
     WHERE id = ?`,
  ).run(
    next.parent_id,
    next.order_idx,
    next.heading_level,
    next.heading,
    next.anchor_slug,
    next.path_text,
    next.category,
    next.text,
    sectionId,
  );
  return next;
}

export function deleteSection(db: Database.Database, sectionId: number) {
  db.prepare('DELETE FROM kdp_chunks WHERE section_id = ?').run(sectionId);
  db.prepare('DELETE FROM kdp_sections WHERE id = ?').run(sectionId);
}

export function updateModal(db: Database.Database, modalId: number, patch: Partial<InsertModalRow>) {
  const current = db.prepare('SELECT * FROM kdp_modals WHERE id = ?').get(modalId) as
    | (InsertModalRow & { policy_id: number })
    | undefined;
  if (!current) return null;
  const next = { ...current, ...patch };
  db.prepare(
    `UPDATE kdp_modals
     SET link_key = ?, label = ?, title = ?, html = ?, text = ?, anchored_section_id = ?, category = ?
     WHERE id = ?`,
  ).run(
    next.link_key,
    next.label,
    next.title,
    next.html,
    next.text,
    next.anchored_section_id,
    next.category,
    modalId,
  );
  return next;
}

export function deleteModal(db: Database.Database, modalId: number) {
  db.prepare('DELETE FROM kdp_chunks WHERE modal_id = ?').run(modalId);
  db.prepare('DELETE FROM kdp_modals WHERE id = ?').run(modalId);
}

export function searchChunks(
  db: Database.Database,
  policyId: number,
  keywords: string[],
  category: KdpCategory | null,
  limit = 30,
): KdpChunk[] {
  const conds: string[] = ['policy_id = ?'];
  const params: unknown[] = [policyId];
  if (category) {
    conds.push('category = ?');
    params.push(category);
  }
  const kwConds: string[] = [];
  keywords.forEach((kw) => {
    if (!kw) return;
    kwConds.push('text LIKE ?');
    params.push(`%${kw}%`);
  });
  if (kwConds.length > 0) {
    conds.push(`(${kwConds.join(' OR ')})`);
  }
  const sql = `SELECT id, policy_id, section_id, modal_id, ord, text, category, heading_path
               FROM kdp_chunks
               WHERE ${conds.join(' AND ')}
               LIMIT ?`;
  params.push(limit);
  return db.prepare(sql).all(...params) as KdpChunk[];
}

export function listChunksByIds(db: Database.Database, ids: number[]): KdpChunk[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT id, policy_id, section_id, modal_id, ord, text, category, heading_path
       FROM kdp_chunks WHERE id IN (${placeholders})`,
    )
    .all(...ids) as KdpChunk[];
}

type QaLogRow = {
  id: number;
  policy_id: number;
  brand: string;
  question: string;
  answer: string;
  citations_json: string;
  model: string;
  category: string | null;
  starred: number;
  created_at: string;
};

export function mapQaLogRow(row: QaLogRow): KdpQaLog {
  let citations: KdpQaLog['citations'] = [];
  try {
    citations = JSON.parse(row.citations_json);
  } catch {
    citations = [];
  }
  return {
    id: row.id,
    policy_id: row.policy_id,
    brand: row.brand as KdpBrand,
    question: row.question,
    answer: row.answer,
    citations,
    model: row.model,
    created_at: row.created_at,
    starred: row.starred,
    category: (row.category ?? null) as KdpQaLog['category'],
  };
}

export function insertQaLog(
  db: Database.Database,
  input: {
    policy_id: number;
    brand: KdpBrand;
    question: string;
    answer: string;
    citations: KdpQaLog['citations'];
    model: string;
    category: KdpCategory | null;
  },
): number {
  const res = db
    .prepare(
      `INSERT INTO kdp_qa_logs (policy_id, brand, question, answer, citations_json, model, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.policy_id,
      input.brand,
      input.question,
      input.answer,
      JSON.stringify(input.citations ?? []),
      input.model,
      input.category,
    );
  return Number(res.lastInsertRowid);
}

export function listQaLogs(db: Database.Database, brand: KdpBrand, limit = 100): KdpQaLog[] {
  const rows = db
    .prepare(
      `SELECT id, policy_id, brand, question, answer, citations_json, model, category, starred, created_at
       FROM kdp_qa_logs WHERE brand = ? ORDER BY starred DESC, created_at DESC LIMIT ?`,
    )
    .all(brand, limit) as QaLogRow[];
  return rows.map(mapQaLogRow);
}

export function getQaLog(db: Database.Database, id: number): KdpQaLog | null {
  const row = db
    .prepare(
      `SELECT id, policy_id, brand, question, answer, citations_json, model, category, starred, created_at
       FROM kdp_qa_logs WHERE id = ?`,
    )
    .get(id) as QaLogRow | undefined;
  return row ? mapQaLogRow(row) : null;
}

export function setQaStarred(db: Database.Database, id: number, starred: boolean) {
  db.prepare('UPDATE kdp_qa_logs SET starred = ? WHERE id = ?').run(starred ? 1 : 0, id);
}

export function deleteQaLog(db: Database.Database, id: number) {
  db.prepare('DELETE FROM kdp_qa_logs WHERE id = ?').run(id);
}

export function insertDiff(
  db: Database.Database,
  brand: KdpBrand,
  fromPolicyId: number | null,
  toPolicyId: number,
  summary: KdpDiffEntry['summary'],
  fullDiff: string,
) {
  db.prepare(
    `INSERT INTO kdp_diffs (brand, from_policy_id, to_policy_id, summary_json, full_diff)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(brand, fromPolicyId, toPolicyId, JSON.stringify(summary), fullDiff);
}

export function listDiffs(db: Database.Database, brand: KdpBrand, limit = 20): KdpDiffEntry[] {
  type DiffRow = {
    id: number;
    brand: string;
    from_policy_id: number | null;
    to_policy_id: number;
    created_at: string;
    summary_json: string;
  };
  const rows = db
    .prepare(
      `SELECT id, brand, from_policy_id, to_policy_id, created_at, summary_json
       FROM kdp_diffs WHERE brand = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(brand, limit) as DiffRow[];
  return rows.map((r) => {
    let summary: KdpDiffEntry['summary'] = { added: 0, removed: 0, changed: 0 };
    try {
      summary = JSON.parse(r.summary_json);
    } catch {
      // keep default
    }
    return {
      id: r.id,
      brand: r.brand as KdpBrand,
      from_policy_id: r.from_policy_id ?? 0,
      to_policy_id: r.to_policy_id,
      created_at: r.created_at,
      summary,
    };
  });
}

export function getDiffFull(db: Database.Database, diffId: number): string | null {
  const row = db.prepare('SELECT full_diff FROM kdp_diffs WHERE id = ?').get(diffId) as
    | { full_diff: string }
    | undefined;
  return row?.full_diff ?? null;
}
