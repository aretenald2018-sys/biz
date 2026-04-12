import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'workdb.sqlite');
const SNAPSHOT_DIR = path.join(ROOT, 'data', 'terms-snapshot');

// dependency-order: parent tables first
const TABLES = [
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
];

if (!fs.existsSync(SNAPSHOT_DIR)) {
  console.error(`스냅샷 디렉토리가 없습니다: ${SNAPSHOT_DIR}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // bulk import 중에는 제약 끄기

const FORCE = process.argv.includes('--force');

function tableEmpty(table) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c === 0;
}

function loadRows(table) {
  const filePath = path.join(SNAPSHOT_DIR, `${table}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function importTable(table, rows) {
  if (rows.length === 0) return 0;
  const columns = Object.keys(rows[0]);
  const placeholders = columns.map((c) => `@${c}`).join(',');
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
  );
  const tx = db.transaction((items) => {
    for (const item of items) stmt.run(item);
  });
  tx(rows);
  return rows.length;
}

const counts = {};
try {
  // 트리거가 import 도중 facts 를 re_review_required 로 바꾸는 것을 방지
  db.prepare('DROP TRIGGER IF EXISTS trg_terms_mark_facts_stale').run();

  for (const table of TABLES) {
    if (!FORCE && !tableEmpty(table)) {
      counts[table] = 'skipped (non-empty)';
      continue;
    }
    const rows = loadRows(table);
    counts[table] = importTable(table, rows);
  }
} finally {
  // 트리거 재생성 (db-schema.ts 와 동일)
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
  db.pragma('foreign_keys = ON');
  db.close();
}

console.log(`✅ terms 스냅샷 import 완료 (${FORCE ? 'force' : 'skip-if-non-empty'})`);
console.log(JSON.stringify(counts, null, 2));
