/**
 * Turnkey Export Script
 *
 * Creates a clean copy of the project with ONLY contract data.
 * All personal data (tickets, emails, annotations, notes) is excluded.
 *
 * Usage: node scripts/export-turnkey.js
 * Output: ../bizsys-turnkey/
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');
const SOURCE_DB = path.join(PROJECT_ROOT, 'data', 'workdb.sqlite');
const OUTPUT_DIR = path.join(PROJECT_ROOT, '..', 'bizsys-turnkey');
const OUTPUT_DATA_DIR = path.join(OUTPUT_DIR, 'data');
const OUTPUT_DB = path.join(OUTPUT_DATA_DIR, 'workdb.sqlite');

// Tables that contain PERSONAL data — will be emptied
const PERSONAL_TABLES = [
  'tickets', 'emails', 'annotations', 'annotation_replies',
  'meta_annotations', 'meta_annotation_replies', 'attachments',
  'notes', 'participants', 'communication_edges',
  'email_flow_steps',
];

// Tables to KEEP fully — shared data
const SHARED_TABLES = ['contracts', 'contract_files', 'schema_version'];

const EXCLUDE_DIRS = new Set(['node_modules', '.next', 'data', '.git']);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.env')) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('=== Turnkey Export ===\n');

// 1. Copy project files
console.log('1. Copying project files (excluding node_modules, .next, data, .git)...');
if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true });
copyDir(PROJECT_ROOT, OUTPUT_DIR);
console.log('   Done.\n');

// 2. Create clean DB
console.log('2. Creating clean database...');
fs.mkdirSync(OUTPUT_DATA_DIR, { recursive: true });

if (fs.existsSync(SOURCE_DB)) {
  // Copy the full DB first, then delete personal data
  fs.copyFileSync(SOURCE_DB, OUTPUT_DB);

  const db = new Database(OUTPUT_DB);
  db.pragma('foreign_keys = OFF');

  // Delete personal data
  for (const table of PERSONAL_TABLES) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
      db.prepare(`DELETE FROM ${table}`).run();
      console.log(`   ${table}: ${count.c} rows removed`);
    } catch (e) {
      // Table might not exist
    }
  }

  // Verify contract data kept
  for (const table of SHARED_TABLES) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
      console.log(`   ${table}: ${count.c} rows KEPT`);
    } catch (e) {}
  }

  db.pragma('foreign_keys = ON');
  db.exec('VACUUM');
  db.close();
} else {
  console.log('   No source DB found. Empty DB will be created on first run.');
}

// 3. README
fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), `# 업무 지원 시스템 — 계약 현황

## 시작 방법

1. Node.js 18 이상 설치: https://nodejs.org/
2. 터미널에서 이 폴더 열기
3. 실행:

\`\`\`bash
npm install
npm run dev
\`\`\`

4. 브라우저에서 http://localhost:3000 접속
5. CONTRACTS 탭에서 계약 현황 확인

## 포함 데이터
- 계약 현황 (contracts)
- 계약 첨부파일 (contract_files)

## 미포함
- 티켓, 이메일, 노트, 메모 등 개인 업무 데이터
`);

console.log('\n3. README.md created');

// Also copy the scripts folder for future use
fs.mkdirSync(path.join(OUTPUT_DIR, 'scripts'), { recursive: true });
fs.copyFileSync(__filename, path.join(OUTPUT_DIR, 'scripts', 'export-turnkey.js'));

console.log(`\n=== Complete ===`);
console.log(`Output: ${OUTPUT_DIR}`);
console.log(`Size: ${(getDirSize(OUTPUT_DIR) / 1024 / 1024).toFixed(1)} MB (before node_modules)`);
console.log('\\nTo deliver: zip the bizsys-turnkey folder and send.');

function getDirSize(dir) {
  let size = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) size += getDirSize(p);
    else size += fs.statSync(p).size;
  }
  return size;
}
