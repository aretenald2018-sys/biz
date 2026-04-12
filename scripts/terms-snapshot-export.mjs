import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'workdb.sqlite');
const SNAPSHOT_DIR = path.join(ROOT, 'data', 'terms-snapshot');

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

if (!fs.existsSync(DB_PATH)) {
  console.error(`DB 파일이 없습니다: ${DB_PATH}`);
  process.exit(1);
}

fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

const db = new Database(DB_PATH, { readonly: true });

const counts = {};
for (const table of TABLES) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  const outFile = path.join(SNAPSHOT_DIR, `${table}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  counts[table] = rows.length;
}

// 메타 파일
fs.writeFileSync(
  path.join(SNAPSHOT_DIR, '_meta.json'),
  `${JSON.stringify({ exported_at: new Date().toISOString(), counts }, null, 2)}\n`,
  'utf8',
);

db.close();

console.log(`✅ terms 스냅샷 저장: ${SNAPSHOT_DIR}`);
console.log(JSON.stringify(counts, null, 2));
