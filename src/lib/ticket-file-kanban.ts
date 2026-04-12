import Database from 'better-sqlite3';
import { normalizeCid } from '@/lib/cid-utils';
import type {
  CreateTicketFileKanbanCardInput,
  CreateTicketFileKanbanCategoryInput,
  ReorderTicketFileKanbanCardInput,
  TicketFileKanbanCard,
  TicketFileKanbanCategory,
  UpdateTicketFileKanbanCardInput,
  UpdateTicketFileKanbanCategoryInput,
} from '@/types/ticket-file-kanban';

const DEFAULT_CATEGORIES = [
  { name: '수신', color: '#00AAD2' },
  { name: '수정발송대기', color: '#5ec4d4' },
  { name: '피드백수신', color: '#d4a04e' },
];

function mapCategoryRows(rows: unknown[]): TicketFileKanbanCategory[] {
  return rows as TicketFileKanbanCategory[];
}

function mapCardRows(rows: unknown[]): TicketFileKanbanCard[] {
  return rows as TicketFileKanbanCard[];
}

function getCategoryCount(db: Database.Database, ticketId: string) {
  return db.prepare('SELECT COUNT(*) as count FROM ticket_file_categories WHERE ticket_id = ?').get(ticketId) as { count: number };
}

export function ensureTicketFileKanbanDefaults(db: Database.Database, ticketId: string) {
  const { count } = getCategoryCount(db, ticketId);
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO ticket_file_categories (ticket_id, name, color, position, is_default)
      VALUES (?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((rows: typeof DEFAULT_CATEGORIES) => {
      rows.forEach((category, index) => {
        insert.run(ticketId, category.name, category.color, index, 1);
      });
    });
    tx(DEFAULT_CATEGORIES);
  }
}

export function listTicketFileKanbanCategories(db: Database.Database, ticketId: string) {
  ensureTicketFileKanbanDefaults(db, ticketId);
  const rows = db.prepare(`
    SELECT c.*, (
      SELECT COUNT(*)
      FROM ticket_file_cards cards
      WHERE cards.category_id = c.id
    ) AS card_count
    FROM ticket_file_categories c
    WHERE c.ticket_id = ?
    ORDER BY c.position ASC, c.created_at ASC
  `).all(ticketId);
  return mapCategoryRows(rows);
}

export function createTicketFileKanbanCategory(
  db: Database.Database,
  ticketId: string,
  input: CreateTicketFileKanbanCategoryInput,
) {
  ensureTicketFileKanbanDefaults(db, ticketId);
  const name = String(input.name || '').trim();
  const color = String(input.color || '#00AAD2').trim() || '#00AAD2';
  if (!name) {
    throw new Error('name is required');
  }

  const maxPosition = db.prepare(`
    SELECT COALESCE(MAX(position), -1) as position
    FROM ticket_file_categories
    WHERE ticket_id = ?
  `).get(ticketId) as { position: number };

  const result = db.prepare(`
    INSERT INTO ticket_file_categories (ticket_id, name, color, position, is_default)
    VALUES (?, ?, ?, ?, 0)
  `).run(ticketId, name, color, maxPosition.position + 1);

  return db.prepare('SELECT * FROM ticket_file_categories WHERE rowid = ?').get(result.lastInsertRowid) as TicketFileKanbanCategory;
}

export function updateTicketFileKanbanCategory(
  db: Database.Database,
  ticketId: string,
  id: string,
  input: UpdateTicketFileKanbanCategoryInput,
) {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of ['name', 'color', 'position', 'is_default'] as const) {
    if (key in input) {
      fields.push(`${key} = ?`);
      values.push((input as Record<string, unknown>)[key]);
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push("updated_at = datetime('now','localtime')");
  values.push(ticketId, id);

  db.prepare(`UPDATE ticket_file_categories SET ${fields.join(', ')} WHERE ticket_id = ? AND id = ?`).run(...values);

  return db.prepare('SELECT * FROM ticket_file_categories WHERE ticket_id = ? AND id = ?').get(ticketId, id) as TicketFileKanbanCategory | undefined;
}

export function deleteTicketFileKanbanCategory(db: Database.Database, ticketId: string, id: string) {
  const row = db.prepare('SELECT is_default FROM ticket_file_categories WHERE ticket_id = ? AND id = ?').get(ticketId, id) as { is_default: number } | undefined;
  if (!row) {
    throw new Error('Category not found');
  }
  if (row.is_default) {
    throw new Error('기본 카테고리는 삭제할 수 없습니다.');
  }
  db.prepare('DELETE FROM ticket_file_categories WHERE ticket_id = ? AND id = ?').run(ticketId, id);
}

function getAttachmentRow(db: Database.Database, ticketId: string, attachmentId: string) {
  return db.prepare(`
    SELECT
      ea.id as email_attachment_id,
      ea.email_id as source_email_id,
      ea.file_name,
      ea.file_type,
      ea.file_size,
      ea.is_image,
      ea.content_id,
      e.subject as source_email_subject,
      e.sender_name as source_email_sender_name,
      e.sender_email as source_email_sender_email,
      e.sent_date as source_email_sent_date
    FROM email_attachments ea
    INNER JOIN emails e ON e.id = ea.email_id
    WHERE ea.id = ? AND e.ticket_id = ?
  `).get(attachmentId, ticketId) as Record<string, unknown> | undefined;
}

export function listTicketFileKanbanCards(db: Database.Database, ticketId: string) {
  const rows = db.prepare(`
    SELECT
      c.id,
      c.ticket_id,
      c.category_id,
      c.email_attachment_id,
      c.file_name,
      c.description,
      c.position,
      c.created_at,
      c.updated_at,
      ea.email_id as source_email_id,
      ea.file_type,
      ea.file_size,
      ea.is_image,
      ea.content_id,
      e.subject as source_email_subject,
      e.sender_name as source_email_sender_name,
      e.sender_email as source_email_sender_email,
      e.sent_date as source_email_sent_date
    FROM ticket_file_cards c
    LEFT JOIN email_attachments ea ON ea.id = c.email_attachment_id
    LEFT JOIN emails e ON e.id = ea.email_id
    WHERE c.ticket_id = ?
    ORDER BY c.category_id ASC, c.position ASC, c.created_at ASC
  `).all(ticketId);
  return mapCardRows(rows);
}

export function createTicketFileKanbanCard(
  db: Database.Database,
  ticketId: string,
  input: CreateTicketFileKanbanCardInput,
) {
  ensureTicketFileKanbanDefaults(db, ticketId);
  const categoryId = String(input.category_id || '').trim();
  if (!categoryId) {
    throw new Error('category_id is required');
  }

  const fileNameFromInput = typeof input.file_name === 'string' ? input.file_name.trim() : '';
  const attachmentId = typeof input.email_attachment_id === 'string' ? input.email_attachment_id.trim() : '';
  const attachmentRow = attachmentId ? getAttachmentRow(db, ticketId, attachmentId) : undefined;
  const fileName = fileNameFromInput || String(attachmentRow?.file_name || '').trim();

  if (!fileName) {
    throw new Error('file_name is required');
  }

  const maxPosition = db.prepare(`
    SELECT COALESCE(MAX(position), -1) as position
    FROM ticket_file_cards
    WHERE ticket_id = ? AND category_id = ?
  `).get(ticketId, categoryId) as { position: number };

  const result = db.prepare(`
    INSERT INTO ticket_file_cards (
      ticket_id,
      category_id,
      email_attachment_id,
      file_name,
      description,
      position
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ticketId,
    categoryId,
    attachmentRow?.email_attachment_id ?? (attachmentId || null),
    fileName,
    typeof input.description === 'string' ? input.description.trim() || null : null,
    maxPosition.position + 1,
  );

  return db.prepare(`
    SELECT
      c.id,
      c.ticket_id,
      c.category_id,
      c.email_attachment_id,
      c.file_name,
      c.description,
      c.position,
      c.created_at,
      c.updated_at,
      ea.email_id as source_email_id,
      ea.file_type,
      ea.file_size,
      ea.is_image,
      ea.content_id,
      e.subject as source_email_subject,
      e.sender_name as source_email_sender_name,
      e.sender_email as source_email_sender_email,
      e.sent_date as source_email_sent_date
    FROM ticket_file_cards c
    LEFT JOIN email_attachments ea ON ea.id = c.email_attachment_id
    LEFT JOIN emails e ON e.id = ea.email_id
    WHERE c.rowid = ?
  `).get(result.lastInsertRowid) as TicketFileKanbanCard;
}

export function updateTicketFileKanbanCard(
  db: Database.Database,
  ticketId: string,
  id: string,
  input: UpdateTicketFileKanbanCardInput,
) {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of ['category_id', 'file_name', 'description', 'position', 'email_attachment_id'] as const) {
    if (key in input) {
      fields.push(`${key} = ?`);
      values.push((input as Record<string, unknown>)[key]);
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push("updated_at = datetime('now','localtime')");
  values.push(ticketId, id);
  db.prepare(`UPDATE ticket_file_cards SET ${fields.join(', ')} WHERE ticket_id = ? AND id = ?`).run(...values);

  return db.prepare(`
    SELECT
      c.id,
      c.ticket_id,
      c.category_id,
      c.email_attachment_id,
      c.file_name,
      c.description,
      c.position,
      c.created_at,
      c.updated_at,
      ea.email_id as source_email_id,
      ea.file_type,
      ea.file_size,
      ea.is_image,
      ea.content_id,
      e.subject as source_email_subject,
      e.sender_name as source_email_sender_name,
      e.sender_email as source_email_sender_email,
      e.sent_date as source_email_sent_date
    FROM ticket_file_cards c
    LEFT JOIN email_attachments ea ON ea.id = c.email_attachment_id
    LEFT JOIN emails e ON e.id = ea.email_id
    WHERE c.ticket_id = ? AND c.id = ?
  `).get(ticketId, id) as TicketFileKanbanCard | undefined;
}

export function deleteTicketFileKanbanCard(db: Database.Database, ticketId: string, id: string) {
  db.prepare('DELETE FROM ticket_file_cards WHERE ticket_id = ? AND id = ?').run(ticketId, id);
}

export function reorderTicketFileKanbanCards(
  db: Database.Database,
  ticketId: string,
  items: ReorderTicketFileKanbanCardInput[],
) {
  const tx = db.transaction((rows: ReorderTicketFileKanbanCardInput[]) => {
    const stmt = db.prepare(`
      UPDATE ticket_file_cards
      SET category_id = ?, position = ?, updated_at = datetime('now','localtime')
      WHERE ticket_id = ? AND id = ?
    `);
    for (const item of rows) {
      stmt.run(item.category_id, item.position, ticketId, item.id);
    }
  });

  tx(items);
}

export function autoPopulateTicketFileKanban(db: Database.Database, ticketId: string) {
  ensureTicketFileKanbanDefaults(db, ticketId);
  const categories = listTicketFileKanbanCategories(db, ticketId);
  const targetCategoryId = categories.find((category) => category.is_default)?.id || categories[0]?.id;
  if (!targetCategoryId) {
    throw new Error('No categories available');
  }

  const existingAttachmentIds = new Set<string>(
    (db.prepare(`
      SELECT email_attachment_id
      FROM ticket_file_cards
      WHERE ticket_id = ? AND email_attachment_id IS NOT NULL
    `).all(ticketId) as Array<{ email_attachment_id: string }>).map((row) => row.email_attachment_id),
  );

  const attachmentRows = db.prepare(`
    SELECT
      ea.id as email_attachment_id,
      ea.email_id as source_email_id,
      ea.file_name,
      ea.file_type,
      ea.file_size,
      ea.is_image,
      ea.content_id,
      e.subject as source_email_subject,
      e.sender_name as source_email_sender_name,
      e.sender_email as source_email_sender_email,
      e.sent_date as source_email_sent_date
    FROM email_attachments ea
    INNER JOIN emails e ON e.id = ea.email_id
    WHERE e.ticket_id = ?
    ORDER BY e.sent_date ASC, ea.created_at ASC
  `).all(ticketId) as Array<Record<string, unknown>>;

  const maxPosition = db.prepare(`
    SELECT COALESCE(MAX(position), -1) as position
    FROM ticket_file_cards
    WHERE ticket_id = ? AND category_id = ?
  `).get(ticketId, targetCategoryId) as { position: number };

  const insert = db.prepare(`
    INSERT INTO ticket_file_cards (
      ticket_id,
      category_id,
      email_attachment_id,
      file_name,
      description,
      position
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((rows: Array<Record<string, unknown>>) => {
    let position = maxPosition.position + 1;
    for (const row of rows) {
      const attachmentId = String(row.email_attachment_id || '');
      if (!attachmentId || existingAttachmentIds.has(attachmentId)) continue;
      // Skip inline CID attachments (e.g. email signature images).
      if (normalizeCid(row.content_id)) continue;
      insert.run(
        ticketId,
        targetCategoryId,
        attachmentId,
        String(row.file_name || 'attachment'),
        null,
        position++,
      );
    }
  });

  tx(attachmentRows);

  return {
    categories: listTicketFileKanbanCategories(db, ticketId),
    cards: listTicketFileKanbanCards(db, ticketId),
  };
}
