import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { register } from 'tsx/esm/api';

const tsconfig = fileURLToPath(new URL('../tsconfig.server.json', import.meta.url));
const unregister = register({ tsconfig });

try {
  const command = process.argv[2];
  const tier = readOption('--tier');

  if (!command) {
    console.error('Usage: node scripts/terms-batch.mjs <conditional-check|full-capture|reparse-changed|gap-scan|candidate-discover> [--tier P0|P1|P2]');
    process.exitCode = 1;
  } else {
    const { getDb } = await import('../src/lib/db.ts');
    const { saveTermsBlob, saveTermsExtractedText } = await import('../server/lib/terms-blob-store.ts');
    const { splitTermsClauses } = await import('../server/lib/terms-clause-splitter.ts');
    const {
      buildTermsGapReport,
    } = await import('../server/lib/terms-gap-detector.ts');
    const {
      deleteExistingVersionFacts,
      ensureTermsBootstrap,
      getLatestTermsVersion,
      getTermsAsset,
      getTermsVersion,
      listTermsAssets,
      listTermsClauses,
    } = await import('../server/lib/terms-db.ts');
    const { discoverTermsCandidates } = await import('../server/lib/terms-discovery.ts');
    const { extractTermsFacts, getProcessingDisplayLabel } = await import('../server/lib/terms-extractor.ts');
    const { fetchConditional } = await import('../server/lib/terms-fetcher.ts');
    const { determineChangeKind } = await import('../server/lib/terms-hasher.ts');
    const { extractTextFromBuffer } = await import('../server/lib/terms-text.ts');

    const db = getDb();
    ensureTermsBootstrap(db);

    switch (command) {
      case 'conditional-check':
      case 'full-capture': {
        const assets = listTermsAssets(db, {
          verification_status: null,
        }).filter((asset) => !tier || asset.monitoring_tier.startsWith(tier));

        let changed = 0;
        let failed = 0;
        let notModified = 0;

        for (const asset of assets) {
          const previous = getLatestTermsVersion(db, asset.id);
          const result = await fetchConditional(asset, previous, { force: command === 'full-capture' });

          if (result.blockedByRobots) {
            recordFailedCapture(db, asset.id, 'auto_fetch', -1);
            failed += 1;
            continue;
          }

          if (result.status === 304) {
            db.prepare(`
              UPDATE terms_assets
              SET last_seen_at = datetime('now','localtime'),
                  updated_at = datetime('now','localtime')
              WHERE id = ?
            `).run(asset.id);
            notModified += 1;
            continue;
          }

          if (!result.buf || result.status < 200 || result.status >= 300) {
            recordFailedCapture(db, asset.id, 'auto_fetch', result.status);
            failed += 1;
            continue;
          }

          const version = await ingestVersion(db, asset.id, {
            buffer: result.buf,
            capture_source: 'auto_fetch',
            etag: result.etag ?? null,
            fileName: inferFileName(asset.url, result.finalUrl, result.mime),
            finalUrl: result.finalUrl ?? asset.url,
            http_status: result.status,
            last_modified_header: result.lastModified ?? null,
            mimeType: result.mime ?? null,
            uploaded_by: null,
          }, {
            determineChangeKind,
            extractTextFromBuffer,
            getLatestTermsVersion,
            saveTermsBlob,
            saveTermsExtractedText,
            splitTermsClauses,
          });
          if (version.change_kind === 'normalized_change' || version.change_kind === 'new') {
            changed += 1;
          }
        }

        console.log(JSON.stringify({ changed, failed, notModified, processed: assets.length }, null, 2));
        break;
      }
      case 'reparse-changed': {
        const versions = db.prepare(`
          SELECT id
          FROM terms_document_versions
          WHERE change_kind IN ('normalized_change', 'new')
          ORDER BY captured_at DESC, id DESC
        `).all() as Array<{ id: number }>;

        let processing = 0;
        let transfer = 0;

        for (const row of versions) {
          const version = getTermsVersion(db, row.id);
          if (!version) continue;
          const asset = getTermsAsset(db, version.asset_id);
          if (!asset) continue;
          const clauses = listTermsClauses(db, version.id);
          if (clauses.length === 0) continue;

          const extracted = await extractTermsFacts({
            market_entity: asset.market_entity,
            controller_entity: asset.controller_entity ?? null,
            service_family: asset.service_family,
            clauses,
          });
          const clauseIds = new Map(clauses.map((clause) => [clause.order_index, clause.id]));

          const tx = db.transaction(() => {
            deleteExistingVersionFacts(db, version.id);

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
                version.id,
              );
              const factId = Number(result.lastInsertRowid);
              fact.evidence.forEach((evidence) => {
                const clauseId = clauseIds.get(evidence.order_index);
                if (clauseId) {
                  insertEvidence.run('processing', factId, clauseId, evidence.excerpt ?? null);
                }
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
                version.id,
              );
              const factId = Number(result.lastInsertRowid);
              fact.evidence.forEach((evidence) => {
                const clauseId = clauseIds.get(evidence.order_index);
                if (clauseId) {
                  insertEvidence.run('transfer', factId, clauseId, evidence.excerpt ?? null);
                }
              });
            });
          });
          tx();

          processing += extracted.processing_facts.length;
          transfer += extracted.transfer_facts.length;
        }

        console.log(JSON.stringify({ versions: versions.length, processing, transfer }, null, 2));
        break;
      }
      case 'gap-scan': {
        const report = buildTermsGapReport(db);
        const outputPath = path.resolve(process.cwd(), 'data', 'terms-gap-report.json');
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
        console.log(JSON.stringify({ path: outputPath, entries: report.length }, null, 2));
        break;
      }
      case 'candidate-discover': {
        const assets = listTermsAssets(db).filter((asset) => !asset.auth_required && asset.channel !== 'pdf');
        const existingUrls = new Set();
        db.prepare('SELECT url FROM terms_assets').all().forEach((row) => {
          if (typeof row.url === 'string') existingUrls.add(row.url);
        });
        db.prepare('SELECT candidate_url FROM terms_asset_candidates').all().forEach((row) => {
          if (typeof row.candidate_url === 'string') existingUrls.add(row.candidate_url);
        });

        let inserted = 0;
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

        for (const asset of assets) {
          const candidates = await discoverTermsCandidates(asset, existingUrls, 1);
          candidates.forEach((candidate) => {
            const result = insertStmt.run(
              candidate.source_url,
              candidate.candidate_url,
              candidate.anchor_text ?? null,
              candidate.hint_market_entity ?? null,
              candidate.hint_service_family ?? null,
              candidate.hint_document_type ?? null,
            );
            inserted += result.changes;
          });
        }

        console.log(JSON.stringify({ assets: assets.length, candidates_added: inserted }, null, 2));
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        process.exitCode = 1;
    }
  }
} finally {
  await unregister();
}

function readOption(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  if (value === 'P0') return 'P0';
  if (value === 'P1') return 'P1';
  if (value === 'P2') return 'P2';
  return null;
}

function recordFailedCapture(db, assetId, captureSource, httpStatus) {
  db.prepare(`
    INSERT INTO terms_document_versions (
      asset_id,
      capture_source,
      http_status,
      change_kind
    )
    VALUES (?, ?, ?, 'none')
  `).run(assetId, captureSource, httpStatus);
  db.prepare(`
    UPDATE terms_assets
    SET verification_status = 'broken',
        last_seen_at = datetime('now','localtime'),
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(assetId);
}

async function ingestVersion(db, assetId, input, deps) {
  const asset = db.prepare('SELECT * FROM terms_assets WHERE id = ?').get(assetId);
  const previous = deps.getLatestTermsVersion(db, assetId);
  const extraction = await deps.extractTextFromBuffer(input.buffer, input.fileName, input.mimeType);
  const raw_hash = sha256(input.buffer);
  const normalized_hash = sha256(extraction.normalized_text);
  const change_kind = deps.determineChangeKind(previous, normalized_hash);
  const extractedLastUpdated = extractDateMarker(extraction.raw_text);

  const result = db.prepare(`
    INSERT INTO terms_document_versions (
      asset_id,
      capture_source,
      http_status,
      etag,
      last_modified_header,
      raw_hash,
      normalized_hash,
      mime_type,
      extracted_last_updated,
      diff_from_prev_id,
      change_kind,
      uploaded_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    assetId,
    input.capture_source,
    input.http_status,
    input.etag,
    input.last_modified_header,
    raw_hash,
    normalized_hash,
    input.mimeType,
    extractedLastUpdated,
    previous?.id ?? null,
    change_kind,
    input.uploaded_by,
  );

  const versionId = Number(result.lastInsertRowid);
  const blobPath = deps.saveTermsBlob(assetId, versionId, input.buffer, input.fileName, input.mimeType);
  const textPath = deps.saveTermsExtractedText(assetId, versionId, extraction.raw_text);
  const clauses = deps.splitTermsClauses({
    html: extraction.html ?? null,
    language: asset.language ?? null,
    text: extraction.raw_text,
  });

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE terms_document_versions
      SET blob_path = ?,
          extracted_text_path = ?,
          extracted_last_updated = ?
      WHERE id = ?
    `).run(blobPath, textPath, extractedLastUpdated, versionId);

    const insertClause = db.prepare(`
      INSERT INTO terms_clauses (
        version_id,
        path,
        heading,
        body,
        language,
        order_index,
        char_start,
        char_end
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    clauses.forEach((clause) => {
      insertClause.run(
        versionId,
        clause.path ?? null,
        clause.heading ?? null,
        clause.body,
        clause.language ?? null,
        clause.order_index,
        clause.char_start ?? null,
        clause.char_end ?? null,
      );
    });

    db.prepare(`
      UPDATE terms_assets
      SET url = ?,
          verification_status = ?,
          last_updated_text = COALESCE(?, last_updated_text),
          last_seen_at = datetime('now','localtime'),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.finalUrl || asset.url,
      input.capture_source === 'auto_fetch' ? 'verified' : asset.verification_status,
      extractedLastUpdated,
      assetId,
    );
  });
  tx();

  return db.prepare('SELECT * FROM terms_document_versions WHERE id = ?').get(versionId);
}

function inferFileName(assetUrl, finalUrl, mimeType) {
  const source = finalUrl || assetUrl;
  try {
    const parsed = new URL(source);
    const base = path.basename(parsed.pathname);
    if (base) {
      return base;
    }
  } catch {
    return 'terms-document';
  }

  if (mimeType?.toLowerCase().includes('pdf')) return 'terms-document.pdf';
  if (mimeType?.toLowerCase().includes('html')) return 'terms-document.html';
  return 'terms-document';
}

function extractDateMarker(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /last updated|effective|updated/i.test(line))
    ?.slice(0, 140) ?? null;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
