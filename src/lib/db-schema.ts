import Database from 'better-sqlite3';

const CURRENT_VERSION = 8;

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
