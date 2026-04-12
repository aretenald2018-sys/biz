import Database from 'better-sqlite3';
import { assignTicketPlacement } from './kanban';

const CURRENT_VERSION = 25;

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
  const currentVersion = row?.v ?? 0;

  if (currentVersion < 1) {
    applyV1(db);
  }
  if (currentVersion < 2) {
    applyV2(db);
  }
  if (currentVersion < 3) {
    applyV3(db);
  }
  if (currentVersion < 4) {
    applyV4(db);
  }
  if (currentVersion < 5) {
    applyV5(db);
  }
  if (currentVersion < 6) {
    applyV6(db);
  }
  if (currentVersion < 7) {
    applyV7(db);
  }
  if (currentVersion < 8) {
    applyV8(db);
  }
  if (currentVersion < 9) {
    applyV9(db);
  }
  if (currentVersion < 10) {
    applyV10(db);
  }
  if (currentVersion < 11) {
    applyV11(db);
  }
  if (currentVersion < 12) {
    applyV12(db);
  }
  if (currentVersion < 13) {
    applyV13(db);
  }
  if (currentVersion < 14) {
    applyV14(db);
  }
  if (currentVersion < 15) {
    applyV15(db);
  }
  if (currentVersion < 16) {
    applyV16(db);
  }
  if (currentVersion < 17) {
    applyV17(db);
  }
  if (currentVersion < 18) {
    applyV18(db);
  }
  if (currentVersion < 19) {
    applyV19(db);
  }
  if (currentVersion < 20) {
    applyV20(db);
  }
  if (currentVersion < 21) {
    applyV21(db);
  }
  if (currentVersion < 22) {
    applyV22(db);
  }
  if (currentVersion < 23) {
    applyV23(db);
  }
  if (currentVersion < 24) {
    applyV24(db);
  }
  if (currentVersion < 25) {
    applyV25(db);
  }
}

function applyV25(db: Database.Database) {
  // 수동으로 입력된 fact 를 구분하기 위한 플래그 컬럼.
  if (!hasColumn(db, 'terms_processing_facts', 'manual_entry')) {
    db.exec(`ALTER TABLE terms_processing_facts ADD COLUMN manual_entry INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, 'terms_transfer_facts', 'manual_entry')) {
    db.exec(`ALTER TABLE terms_transfer_facts ADD COLUMN manual_entry INTEGER NOT NULL DEFAULT 0`);
  }
  db.prepare(`INSERT INTO schema_version (version) VALUES (25)`).run();
}

function applyV24(db: Database.Database) {
  // HME 소속이지만 HCM_GmbH 가 관할하던 자산·fact 들을 HCM 법인으로 이관.
  // KEU 소속이지만 KCONNECT 가 관할하던 건도 KCONNECT 법인으로 이관.
  // seed-upsert 가 먼저 돌아 HCM/KCONNECT 중복 행을 만든 경우가 있으므로
  // 그 중복을 먼저 정리한 뒤 원 행의 market_entity 만 갱신.
  db.exec(`
    DELETE FROM terms_assets
     WHERE market_entity = 'HCM'
       AND EXISTS (
         SELECT 1 FROM terms_assets orig
          WHERE orig.market_entity = 'HME'
            AND orig.controller_entity = 'HCM_GmbH'
            AND orig.service_family = terms_assets.service_family
            AND orig.document_type = terms_assets.document_type
            AND orig.channel = terms_assets.channel
            AND orig.url = terms_assets.url
            AND ifnull(orig.language, '') = ifnull(terms_assets.language, '')
       );

    DELETE FROM terms_assets
     WHERE market_entity = 'KCONNECT'
       AND EXISTS (
         SELECT 1 FROM terms_assets orig
          WHERE orig.market_entity = 'KEU'
            AND orig.controller_entity = 'KCONNECT'
            AND orig.service_family = terms_assets.service_family
            AND orig.document_type = terms_assets.document_type
            AND orig.channel = terms_assets.channel
            AND orig.url = terms_assets.url
            AND ifnull(orig.language, '') = ifnull(terms_assets.language, '')
       );

    UPDATE terms_assets
       SET market_entity = 'HCM'
     WHERE market_entity = 'HME' AND controller_entity = 'HCM_GmbH';

    UPDATE terms_assets
       SET market_entity = 'KCONNECT'
     WHERE market_entity = 'KEU' AND controller_entity = 'KCONNECT';

    UPDATE terms_processing_facts
       SET market_entity = 'HCM'
     WHERE market_entity = 'HME' AND controller_entity = 'HCM_GmbH';

    UPDATE terms_processing_facts
       SET market_entity = 'KCONNECT'
     WHERE market_entity = 'KEU' AND controller_entity = 'KCONNECT';

    UPDATE terms_transfer_facts
       SET market_entity = 'HCM'
     WHERE market_entity = 'HME' AND controller_entity = 'HCM_GmbH';

    UPDATE terms_transfer_facts
       SET market_entity = 'KCONNECT'
     WHERE market_entity = 'KEU' AND controller_entity = 'KCONNECT';
  `);

  db.prepare(`INSERT INTO schema_version (version) VALUES (24)`).run();
}

function applyV23(db: Database.Database) {
  if (!hasColumn(db, 'terms_market_entities', 'brand')) {
    db.exec(`
      ALTER TABLE terms_market_entities ADD COLUMN brand TEXT NOT NULL DEFAULT 'hyundai';
    `);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_terms_market_entities_brand ON terms_market_entities(brand);

    UPDATE terms_assets
       SET service_family = 'connected_services'
     WHERE service_family IN ('bluelink', 'connected_mobility');

    UPDATE terms_assets
       SET service_family = 'navigation_update'
     WHERE service_family = 'navigation';

    UPDATE terms_assets
       SET service_family = 'store_payment'
     WHERE service_family IN ('payment', 'bluelink_store');

    UPDATE terms_processing_facts
       SET service_family = 'connected_services'
     WHERE service_family IN ('bluelink', 'connected_mobility');

    UPDATE terms_processing_facts
       SET service_family = 'navigation_update'
     WHERE service_family = 'navigation';

    UPDATE terms_processing_facts
       SET service_family = 'store_payment'
     WHERE service_family IN ('payment', 'bluelink_store');

    UPDATE terms_transfer_facts
       SET service_family = 'connected_services'
     WHERE service_family IN ('bluelink', 'connected_mobility');

    UPDATE terms_transfer_facts
       SET service_family = 'navigation_update'
     WHERE service_family = 'navigation';

    UPDATE terms_transfer_facts
       SET service_family = 'store_payment'
     WHERE service_family IN ('payment', 'bluelink_store');

    UPDATE terms_applicability
       SET service_family = 'connected_services'
     WHERE service_family IN ('bluelink', 'connected_mobility');

    UPDATE terms_applicability
       SET service_family = 'navigation_update'
     WHERE service_family = 'navigation';

    UPDATE terms_applicability
       SET service_family = 'store_payment'
     WHERE service_family IN ('payment', 'bluelink_store');

    UPDATE terms_asset_candidates
       SET hint_service_family = 'connected_services'
     WHERE hint_service_family IN ('bluelink', 'connected_mobility');

    UPDATE terms_asset_candidates
       SET hint_service_family = 'navigation_update'
     WHERE hint_service_family = 'navigation';

    UPDATE terms_asset_candidates
       SET hint_service_family = 'store_payment'
     WHERE hint_service_family IN ('payment', 'bluelink_store');

    UPDATE terms_market_entities
       SET brand = 'hyundai'
     WHERE ifnull(brand, '') = '';

    INSERT INTO schema_version (version) VALUES (23);
  `);
}

function applyV22(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS terms_market_entities (
      code TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      region TEXT NOT NULL,
      country TEXT NOT NULL,
      owner_team TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS terms_controllers (
      code TEXT PRIMARY KEY,
      legal_name TEXT NOT NULL,
      region TEXT,
      jurisdiction TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS terms_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_entity TEXT NOT NULL REFERENCES terms_market_entities(code),
      controller_entity TEXT REFERENCES terms_controllers(code),
      service_family TEXT NOT NULL,
      document_type TEXT NOT NULL,
      channel TEXT NOT NULL,
      url TEXT NOT NULL,
      language TEXT,
      auth_required INTEGER NOT NULL DEFAULT 0,
      monitoring_tier TEXT NOT NULL DEFAULT 'P1_weekly',
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      last_updated_text TEXT,
      effective_date TEXT,
      last_seen_at TEXT,
      owner_team TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_terms_assets_entity ON terms_assets(market_entity);
    CREATE INDEX IF NOT EXISTS idx_terms_assets_tier ON terms_assets(monitoring_tier);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_assets_unique
      ON terms_assets(market_entity, service_family, document_type, channel, url, ifnull(language, ''));

    CREATE TABLE IF NOT EXISTS terms_asset_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      source_url TEXT NOT NULL,
      candidate_url TEXT NOT NULL,
      anchor_text TEXT,
      hint_market_entity TEXT,
      hint_service_family TEXT,
      hint_document_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      promoted_asset_id INTEGER REFERENCES terms_assets(id),
      rejected_reason TEXT,
      reviewer TEXT,
      reviewed_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_asset_candidates_unique
      ON terms_asset_candidates(candidate_url);
    CREATE INDEX IF NOT EXISTS idx_terms_asset_candidates_status
      ON terms_asset_candidates(status, discovered_at DESC);

    CREATE TABLE IF NOT EXISTS terms_applicability (
      market_entity TEXT NOT NULL REFERENCES terms_market_entities(code),
      service_family TEXT NOT NULL,
      document_type TEXT NOT NULL,
      requirement TEXT NOT NULL,
      rationale TEXT,
      PRIMARY KEY (market_entity, service_family, document_type)
    );

    CREATE TABLE IF NOT EXISTS terms_document_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES terms_assets(id),
      captured_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      capture_source TEXT NOT NULL,
      http_status INTEGER,
      etag TEXT,
      last_modified_header TEXT,
      raw_hash TEXT,
      normalized_hash TEXT,
      mime_type TEXT,
      blob_path TEXT,
      extracted_text_path TEXT,
      extracted_last_updated TEXT,
      diff_from_prev_id INTEGER REFERENCES terms_document_versions(id),
      change_kind TEXT,
      uploaded_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_terms_dv_asset ON terms_document_versions(asset_id);
    CREATE INDEX IF NOT EXISTS idx_terms_dv_hash ON terms_document_versions(normalized_hash);

    CREATE TABLE IF NOT EXISTS terms_clauses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL REFERENCES terms_document_versions(id),
      path TEXT,
      heading TEXT,
      body TEXT NOT NULL,
      language TEXT,
      order_index INTEGER NOT NULL,
      char_start INTEGER,
      char_end INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_terms_clauses_version ON terms_clauses(version_id);

    CREATE TABLE IF NOT EXISTS terms_processing_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_entity TEXT NOT NULL REFERENCES terms_market_entities(code),
      controller_entity TEXT REFERENCES terms_controllers(code),
      service_family TEXT NOT NULL,
      category TEXT NOT NULL,
      taxonomy_code TEXT NOT NULL,
      display_label TEXT,
      condition TEXT,
      confidence REAL,
      review_status TEXT NOT NULL DEFAULT 'pending',
      reviewer TEXT,
      reviewed_at TEXT,
      latest_version_id INTEGER REFERENCES terms_document_versions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_pf_entity_category
      ON terms_processing_facts(market_entity, category, review_status);
    CREATE INDEX IF NOT EXISTS idx_pf_latest_version
      ON terms_processing_facts(latest_version_id);

    CREATE TABLE IF NOT EXISTS terms_transfer_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_entity TEXT NOT NULL REFERENCES terms_market_entities(code),
      controller_entity TEXT REFERENCES terms_controllers(code),
      service_family TEXT NOT NULL,
      data_taxonomy_code TEXT,
      purpose_taxonomy_code TEXT,
      destination_country TEXT NOT NULL,
      recipient_entity TEXT,
      transfer_mechanism TEXT,
      legal_basis TEXT,
      status TEXT NOT NULL,
      condition TEXT,
      confidence REAL,
      review_status TEXT NOT NULL DEFAULT 'pending',
      reviewer TEXT,
      reviewed_at TEXT,
      latest_version_id INTEGER REFERENCES terms_document_versions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_tf_entity_kr
      ON terms_transfer_facts(market_entity, destination_country, review_status);
    CREATE INDEX IF NOT EXISTS idx_tf_latest_version
      ON terms_transfer_facts(latest_version_id);

    CREATE TABLE IF NOT EXISTS terms_fact_evidence (
      fact_type TEXT NOT NULL CHECK(fact_type IN ('processing','transfer')),
      fact_id INTEGER NOT NULL,
      clause_id INTEGER NOT NULL REFERENCES terms_clauses(id),
      excerpt TEXT,
      PRIMARY KEY (fact_type, fact_id, clause_id)
    );
    CREATE INDEX IF NOT EXISTS idx_terms_fact_evidence_fact
      ON terms_fact_evidence(fact_type, fact_id);

    DROP TRIGGER IF EXISTS trg_terms_mark_facts_stale;
    CREATE TRIGGER trg_terms_mark_facts_stale
    AFTER INSERT ON terms_document_versions
    WHEN NEW.change_kind IN ('normalized_change','new')
    BEGIN
      UPDATE terms_processing_facts
         SET review_status = 're_review_required'
       WHERE review_status = 'approved'
         AND latest_version_id IN (
           SELECT id
           FROM terms_document_versions
           WHERE asset_id = NEW.asset_id
             AND id <> NEW.id
         );

      UPDATE terms_transfer_facts
         SET review_status = 're_review_required'
       WHERE review_status = 'approved'
         AND latest_version_id IN (
           SELECT id
           FROM terms_document_versions
           WHERE asset_id = NEW.asset_id
             AND id <> NEW.id
         );
    END;

    INSERT INTO schema_version (version) VALUES (22);
  `);
}

function applyV21(db: Database.Database) {
  if (!hasColumn(db, 'docx_diff_uploads', 'file_type')) {
    db.exec(`
      ALTER TABLE docx_diff_uploads ADD COLUMN file_type TEXT;
    `);
  }

  if (!hasColumn(db, 'docx_diff_uploads', 'overridden_text')) {
    db.exec(`
      ALTER TABLE docx_diff_uploads ADD COLUMN overridden_text TEXT;
    `);
  }

  db.exec(`
    INSERT INTO schema_version (version) VALUES (21);
  `);
}

function applyV1(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT '신규'
        CHECK(status IN ('신규','진행중','검토중','종결','보류')),
      ai_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);

    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_blob BLOB NOT NULL,
      subject TEXT,
      sender_name TEXT,
      sender_email TEXT,
      recipients TEXT,
      cc_list TEXT,
      body_text TEXT,
      body_html TEXT,
      sent_date TEXT,
      parsed_participants TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_emails_ticket ON emails(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(sent_date);

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      selected_text TEXT NOT NULL,
      note TEXT NOT NULL,
      color TEXT DEFAULT '#00ffff',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_annotations_email ON annotations(email_id);

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT,
      title TEXT,
      department TEXT,
      organization TEXT,
      UNIQUE(ticket_id, email)
    );

    CREATE INDEX IF NOT EXISTS idx_participants_ticket ON participants(ticket_id);

    CREATE TABLE IF NOT EXISTS communication_edges (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      from_participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      to_participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      direction TEXT DEFAULT 'sent',
      UNIQUE(email_id, from_participant_id, to_participant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_edges_ticket ON communication_edges(ticket_id);

    INSERT INTO schema_version (version) VALUES (1);
  `);
}

function applyV2(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS annotation_replies (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_replies_annotation ON annotation_replies(annotation_id);

    INSERT INTO schema_version (version) VALUES (2);
  `);
}

function applyV3(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta_annotations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      selected_text TEXT NOT NULL,
      note TEXT NOT NULL,
      color TEXT DEFAULT '#5ec4d4',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_meta_ann_parent ON meta_annotations(annotation_id);

    CREATE TABLE IF NOT EXISTS meta_annotation_replies (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      meta_annotation_id TEXT NOT NULL REFERENCES meta_annotations(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_meta_replies_parent ON meta_annotation_replies(meta_annotation_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      parent_type TEXT NOT NULL CHECK(parent_type IN ('annotation','meta_annotation')),
      parent_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_blob BLOB NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER NOT NULL DEFAULT 0,
      is_image INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_parent ON attachments(parent_type, parent_id);

    INSERT INTO schema_version (version) VALUES (3);
  `);
}

function applyV4(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_notes_ticket ON notes(ticket_id);

    INSERT INTO schema_version (version) VALUES (4);
  `);
}

function applyV5(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      region TEXT NOT NULL,
      country TEXT NOT NULL,
      entity_code TEXT NOT NULL,
      brand TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      data_domain_vehicle TEXT CHECK(data_domain_vehicle IN ('O','X','null')) DEFAULT 'null',
      data_domain_customer TEXT CHECK(data_domain_customer IN ('O','X','null')) DEFAULT 'null',
      data_domain_sales TEXT CHECK(data_domain_sales IN ('O','X','null')) DEFAULT 'null',
      data_domain_quality TEXT CHECK(data_domain_quality IN ('O','X','null')) DEFAULT 'null',
      data_domain_production TEXT CHECK(data_domain_production IN ('O','X','null')) DEFAULT 'null',
      contract_status TEXT,
      transfer_purpose TEXT,
      transferable_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_contracts_region ON contracts(region);
    CREATE INDEX IF NOT EXISTS idx_contracts_entity_code ON contracts(entity_code);
    CREATE INDEX IF NOT EXISTS idx_contracts_brand ON contracts(brand);

    CREATE TABLE IF NOT EXISTS contract_files (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      file_category TEXT NOT NULL CHECK(file_category IN ('final_contract','related_document','correspondence')),
      file_name TEXT NOT NULL,
      file_blob BLOB NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_contract_files_contract ON contract_files(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_files_category ON contract_files(file_category);

    INSERT INTO schema_version (version) VALUES (5);
  `);
}

function applyV6(db: Database.Database) {
  db.exec(`
    ALTER TABLE annotations ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE meta_annotations ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;

    INSERT INTO schema_version (version) VALUES (6);
  `);
}

function applyV7(db: Database.Database) {
  db.exec(`
    ALTER TABLE annotations ADD COLUMN note_id TEXT REFERENCES notes(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_annotations_note ON annotations(note_id);

    INSERT INTO schema_version (version) VALUES (7);
  `);
}

function applyV8(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_flow_steps (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      step_type TEXT NOT NULL CHECK(step_type IN ('request','response','follow_up')),
      actor TEXT,
      summary TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 0,
      step_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_flow_steps_email ON email_flow_steps(email_id);

    INSERT INTO schema_version (version) VALUES (8);
  `);
}

function applyV9(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contract_versions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL DEFAULT 1,
      change_reason TEXT,
      transfer_purpose TEXT,
      transferable_data TEXT,
      effective_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_contract_versions_contract ON contract_versions(contract_id);

    ALTER TABLE contracts ADD COLUMN last_activity_at TEXT;
    ALTER TABLE contract_files ADD COLUMN version_id TEXT REFERENCES contract_versions(id);

    INSERT INTO schema_version (version) VALUES (9);
  `);
}

function applyV10(db: Database.Database) {
  db.exec(`
    ALTER TABLE notes ADD COLUMN parent_email_id TEXT REFERENCES emails(id) ON DELETE SET NULL;
    ALTER TABLE emails ADD COLUMN parent_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_notes_parent_email ON notes(parent_email_id);
    CREATE INDEX IF NOT EXISTS idx_emails_parent_note ON emails(parent_note_id);

    INSERT INTO schema_version (version) VALUES (10);
  `);
}

function applyV11(db: Database.Database) {
  db.exec(`
    ALTER TABLE notes ADD COLUMN parent_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL;
    ALTER TABLE emails ADD COLUMN parent_email_id TEXT REFERENCES emails(id) ON DELETE SET NULL;

    INSERT INTO schema_version (version) VALUES (11);
  `);
}

function applyV12(db: Database.Database) {
  db.exec(`
    ALTER TABLE contract_versions ADD COLUMN added_domains TEXT;
    ALTER TABLE contract_versions ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed'));

    INSERT INTO schema_version (version) VALUES (12);
  `);
}

function applyV14(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
      url TEXT,
      color TEXT NOT NULL DEFAULT '#5ec4d4',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_dates ON schedules(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_schedules_ticket ON schedules(ticket_id);

    INSERT INTO schema_version (version) VALUES (14);
  `);
}

function applyV13(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_attachments (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_blob BLOB NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER NOT NULL DEFAULT 0,
      is_image INTEGER NOT NULL DEFAULT 0,
      content_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_email_attachments_email ON email_attachments(email_id);

    INSERT INTO schema_version (version) VALUES (13);
  `);
}

function applyV15(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kanban_categories (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#00AAD2',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS kanban_cards (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      category_id TEXT NOT NULL REFERENCES kanban_categories(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_kanban_categories_position ON kanban_categories(position);
    CREATE INDEX IF NOT EXISTS idx_kanban_cards_category_position ON kanban_cards(category_id, position);
    CREATE INDEX IF NOT EXISTS idx_kanban_cards_ticket ON kanban_cards(ticket_id);

    INSERT INTO schema_version (version) VALUES (15);
  `);
}

function applyV16(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_file_categories (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#00AAD2',
      position INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_ticket_file_categories_ticket ON ticket_file_categories(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_file_categories_position ON ticket_file_categories(ticket_id, position);

    CREATE TABLE IF NOT EXISTS ticket_file_cards (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES ticket_file_categories(id) ON DELETE CASCADE,
      email_attachment_id TEXT UNIQUE REFERENCES email_attachments(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      description TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_ticket_file_cards_ticket ON ticket_file_cards(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_file_cards_category_position ON ticket_file_cards(category_id, position);

    INSERT INTO schema_version (version) VALUES (16);
  `);
}

function applyV17(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS generation_templates (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      type TEXT NOT NULL CHECK(type IN ('weekly_report','dooray')),
      name TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_generation_templates_type ON generation_templates(type, is_default DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS generation_best_practices (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      type TEXT NOT NULL CHECK(type IN ('weekly_report','dooray')),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_generation_best_practices_type ON generation_best_practices(type, created_at DESC);

    INSERT INTO generation_templates (type, name, content, is_default)
    SELECT 'weekly_report', '기본 주간보고 템플릿',
           '## 주간보고\n\n### 1. 금주 주요 활동\n- 처리된 이메일 및 회신 현황\n- 주요 의사결정 사항\n\n### 2. 이슈 및 현황\n- 미해결 이슈\n- 리스크 요소\n\n### 3. 차주 계획\n- 예정된 회신/발송\n- 후속 조치 사항\n\n### 4. 기타',
           1
    WHERE NOT EXISTS (SELECT 1 FROM generation_templates WHERE type = 'weekly_report' AND is_default = 1);

    INSERT INTO generation_templates (type, name, content, is_default)
    SELECT 'dooray', '기본 두레이 템플릿',
           '## 업무 보고\n\n### 배경 및 경위\n### 주요 내용\n### 현재 상태\n### 향후 계획',
           1
    WHERE NOT EXISTS (SELECT 1 FROM generation_templates WHERE type = 'dooray' AND is_default = 1);

    INSERT INTO schema_version (version) VALUES (17);
  `);
}

function applyV18(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_templates (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      title TEXT NOT NULL,
      content_html TEXT NOT NULL DEFAULT '',
      description TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS template_variables (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      template_id TEXT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
      var_key TEXT NOT NULL,
      var_label TEXT NOT NULL,
      var_type TEXT NOT NULL DEFAULT 'text',
      default_value TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(template_id, var_key)
    );

    CREATE TABLE IF NOT EXISTS company_profiles (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS company_variable_values (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      company_id TEXT NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
      variable_id TEXT NOT NULL REFERENCES template_variables(id) ON DELETE CASCADE,
      value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(company_id, variable_id)
    );

    CREATE TABLE IF NOT EXISTS document_instances (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      template_id TEXT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
      rendered_html TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','approved','signed')),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_document_templates_updated ON document_templates(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_template_variables_template ON template_variables(template_id, sort_order, created_at);
    CREATE INDEX IF NOT EXISTS idx_company_values_company ON company_variable_values(company_id, variable_id);
    CREATE INDEX IF NOT EXISTS idx_document_instances_template ON document_instances(template_id, company_id, updated_at DESC);

    INSERT INTO schema_version (version) VALUES (18);
  `);
}

function applyV19(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS docx_templates (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      filename TEXT NOT NULL,
      display_name TEXT,
      file_blob BLOB NOT NULL,
      preview_html TEXT,
      placeholders_json TEXT,
      tiptap_html TEXT,
      anchor_inserts_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS docx_diff_uploads (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      filename TEXT NOT NULL,
      file_blob BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_docx_templates_updated ON docx_templates(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_docx_diff_uploads_created ON docx_diff_uploads(created_at DESC);

    INSERT INTO schema_version (version) VALUES (19);
  `);
}

function applyV20(db: Database.Database) {
  if (!hasColumn(db, 'tickets', 'category_id')) {
    db.exec(`
      ALTER TABLE tickets
      ADD COLUMN category_id TEXT REFERENCES kanban_categories(id) ON DELETE SET NULL;
    `);
  }

  if (!hasColumn(db, 'tickets', 'position')) {
    db.exec(`
      ALTER TABLE tickets
      ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
    `);
  }

  const tx = db.transaction(() => {
    if (tableExists(db, 'kanban_cards')) {
      const cardRows = db.prepare(`
        SELECT rowid, ticket_id, category_id, position
        FROM kanban_cards
        WHERE ticket_id IS NOT NULL
        ORDER BY created_at ASC, rowid ASC
      `).all() as Array<{ ticket_id: string; category_id: string; position: number }>;

      const appliedTicketIds = new Set<string>();
      const applyCardPlacement = db.prepare(`
        UPDATE tickets
        SET category_id = ?, position = ?, updated_at = datetime('now','localtime')
        WHERE id = ?
      `);

      for (const card of cardRows) {
        if (appliedTicketIds.has(card.ticket_id)) {
          continue;
        }

        applyCardPlacement.run(card.category_id, card.position, card.ticket_id);
        appliedTicketIds.add(card.ticket_id);
      }
    }

    const ticketsWithoutCategory = db.prepare(`
      SELECT id, status
      FROM tickets
      WHERE COALESCE(category_id, '') = ''
      ORDER BY created_at ASC, rowid ASC
    `).all() as Array<{ id: string; status: string }>;

    for (const ticket of ticketsWithoutCategory) {
      assignTicketPlacement(db, {
        ticketId: ticket.id,
        status: ticket.status,
      });
    }

    if (tableExists(db, 'schedules')) {
      const schedulesWithoutTicket = db.prepare(`
        SELECT s.id, s.title, s.description
        FROM schedules s
        LEFT JOIN tickets t ON t.id = s.ticket_id
        WHERE s.ticket_id IS NULL OR t.id IS NULL
        ORDER BY s.created_at ASC, s.rowid ASC
      `).all() as Array<{ id: string; title: string; description: string | null }>;

      const insertTicket = db.prepare(`
        INSERT INTO tickets (title, description)
        VALUES (?, ?)
      `);
      const readInsertedTicket = db.prepare(`
        SELECT id, status
        FROM tickets
        WHERE rowid = ?
      `);
      const attachScheduleTicket = db.prepare(`
        UPDATE schedules
        SET ticket_id = ?, updated_at = datetime('now','localtime')
        WHERE id = ?
      `);

      for (const schedule of schedulesWithoutTicket) {
        const result = insertTicket.run(schedule.title, schedule.description || null);
        const insertedTicket = readInsertedTicket.get(result.lastInsertRowid) as { id: string; status: string } | undefined;
        if (!insertedTicket) {
          continue;
        }

        assignTicketPlacement(db, {
          ticketId: insertedTicket.id,
          status: insertedTicket.status,
        });

        attachScheduleTicket.run(insertedTicket.id, schedule.id);
      }

      recreateSchedulesTable(db);
    }

    if (tableExists(db, 'kanban_cards')) {
      db.exec(`
        DROP TABLE kanban_cards;
      `);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_category_position ON tickets(category_id, position);
    `);

    db.exec(`
      INSERT INTO schema_version (version) VALUES (20);
    `);
  });

  tx();
}

function tableExists(db: Database.Database, tableName: string) {
  const row = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(tableName) as { name?: string } | undefined;

  return Boolean(row?.name);
}

function hasColumn(db: Database.Database, tableName: string, columnName: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function recreateSchedulesTable(db: Database.Database) {
  db.exec(`
    ALTER TABLE schedules RENAME TO schedules_v20_legacy;

    CREATE TABLE schedules (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      url TEXT,
      color TEXT NOT NULL DEFAULT '#5ec4d4',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    INSERT INTO schedules (id, title, description, start_date, end_date, ticket_id, url, color, created_at, updated_at)
    SELECT id, title, description, start_date, end_date, ticket_id, url, color, created_at, updated_at
    FROM schedules_v20_legacy;

    DROP TABLE schedules_v20_legacy;

    CREATE INDEX idx_schedules_dates ON schedules(start_date, end_date);
    CREATE INDEX idx_schedules_ticket ON schedules(ticket_id);
  `);
}
