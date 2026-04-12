import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'workdb.sqlite');

function readJson(filename) {
  const p = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const marketEntities = readJson('terms-market-entities.json');
const controllers = readJson('terms-controllers.json');
const applicability = readJson('terms-applicability-matrix.json');
const seedAssets = readJson('terms-seed.json');

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
  SELECT id FROM terms_assets
  WHERE market_entity = ? AND service_family = ? AND document_type = ?
    AND channel = ? AND url = ? AND ifnull(language, '') = ifnull(?, '')
  LIMIT 1
`);
const insertAssetStmt = db.prepare(`
  INSERT INTO terms_assets (
    market_entity, controller_entity, service_family, document_type, channel, url,
    language, auth_required, monitoring_tier, verification_status,
    last_updated_text, effective_date, owner_team, notes
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

const tx = db.transaction(() => {
  for (const item of marketEntities) {
    marketEntityStmt.run({
      code: item.code,
      display_name: item.display_name,
      region: item.region,
      country: item.country,
      brand: item.brand,
      owner_team: item.owner_team ?? null,
      notes: item.notes ?? null,
    });
  }
  for (const item of controllers) {
    controllerStmt.run({
      code: item.code,
      legal_name: item.legal_name,
      region: item.region ?? null,
      jurisdiction: item.jurisdiction ?? null,
      notes: item.notes ?? null,
    });
  }
  for (const item of applicability) {
    applicabilityStmt.run({
      market_entity: item.market_entity,
      service_family: item.service_family,
      document_type: item.document_type,
      requirement: item.requirement,
      rationale: item.rationale ?? null,
    });
  }
  for (const asset of seedAssets) {
    const existing = findAssetStmt.get(
      asset.market_entity,
      asset.service_family,
      asset.document_type,
      asset.channel,
      asset.url,
      asset.language ?? null,
    );
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
      continue;
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
  }
});

tx();

const counts = {
  market_entities: db.prepare('SELECT COUNT(*) AS c FROM terms_market_entities').get().c,
  controllers: db.prepare('SELECT COUNT(*) AS c FROM terms_controllers').get().c,
  applicability: db.prepare('SELECT COUNT(*) AS c FROM terms_applicability').get().c,
  assets: db.prepare('SELECT COUNT(*) AS c FROM terms_assets').get().c,
};

console.log(JSON.stringify(counts, null, 2));
db.close();
