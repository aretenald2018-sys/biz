import Database from 'better-sqlite3';
import type { KanbanBoardColumn, KanbanBoardView, KanbanCategory, ReorderKanbanTicketInput } from '@/types/kanban';
import type { Ticket } from '@/types/ticket';

const UNCATEGORIZED_CATEGORY_NAME = '\uBBF8\uBD84\uB958';
const UNCATEGORIZED_CATEGORY_COLOR = '#64748B';

function readCategory(db: Database.Database, id: string) {
  return db.prepare('SELECT * FROM kanban_categories WHERE id = ?').get(id) as KanbanCategory | undefined;
}

function readCategoryByName(db: Database.Database, name: string, excludingId?: string | null) {
  if (excludingId) {
    return db.prepare(`
      SELECT *
      FROM kanban_categories
      WHERE name = ? AND id != ?
      ORDER BY position ASC, created_at ASC
      LIMIT 1
    `).get(name, excludingId) as KanbanCategory | undefined;
  }

  return db.prepare(`
    SELECT *
    FROM kanban_categories
    WHERE name = ?
    ORDER BY position ASC, created_at ASC
    LIMIT 1
  `).get(name) as KanbanCategory | undefined;
}

export function getNextTicketPosition(db: Database.Database, categoryId: string) {
  const row = db.prepare(`
    SELECT COALESCE(MAX(position), -1) as position
    FROM tickets
    WHERE category_id = ?
  `).get(categoryId) as { position: number };

  return row.position + 1;
}

export function ensureUncategorizedCategory(
  db: Database.Database,
  options: { excludingId?: string | null } = {},
) {
  const existing = readCategoryByName(db, UNCATEGORIZED_CATEGORY_NAME, options.excludingId);
  if (existing) {
    return existing;
  }

  const maxPosition = db.prepare(`
    SELECT COALESCE(MAX(position), -1) as position
    FROM kanban_categories
  `).get() as { position: number };

  const result = db.prepare(`
    INSERT INTO kanban_categories (name, color, position)
    VALUES (?, ?, ?)
  `).run(UNCATEGORIZED_CATEGORY_NAME, UNCATEGORIZED_CATEGORY_COLOR, maxPosition.position + 1);

  return db.prepare('SELECT * FROM kanban_categories WHERE rowid = ?').get(result.lastInsertRowid) as KanbanCategory;
}

export function resolveTicketCategory(
  db: Database.Database,
  status: string,
  requestedCategoryId?: string | null,
) {
  const requestedCategory = requestedCategoryId ? readCategory(db, requestedCategoryId) : undefined;
  if (requestedCategory) {
    return requestedCategory;
  }

  const matchingCategory = readCategoryByName(db, status);
  if (matchingCategory) {
    return matchingCategory;
  }

  return ensureUncategorizedCategory(db);
}

export function assignTicketPlacement(
  db: Database.Database,
  input: {
    ticketId: string;
    status: string;
    categoryId?: string | null;
    position?: number | null;
  },
) {
  const category = resolveTicketCategory(db, input.status, input.categoryId);
  const position =
    typeof input.position === 'number' && Number.isFinite(input.position)
      ? Math.max(0, Math.trunc(input.position))
      : getNextTicketPosition(db, category.id);

  db.prepare(`
    UPDATE tickets
    SET category_id = ?, position = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(category.id, position, input.ticketId);

  return { categoryId: category.id, position };
}

export function reorderKanbanTickets(db: Database.Database, items: ReorderKanbanTicketInput[]) {
  const tx = db.transaction((rows: ReorderKanbanTicketInput[]) => {
    const stmt = db.prepare(`
      UPDATE tickets
      SET category_id = ?, position = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `);

    for (const item of rows) {
      stmt.run(item.category_id, item.position, item.ticketId);
    }
  });

  tx(items);
}

export function getKanbanBoardView(db: Database.Database): KanbanBoardView {
  const categories = db.prepare(`
    SELECT *
    FROM kanban_categories
    ORDER BY position ASC, created_at ASC
  `).all() as KanbanCategory[];

  const tickets = db.prepare(`
    SELECT *
    FROM tickets
    WHERE category_id IS NOT NULL
    ORDER BY category_id ASC, position ASC, created_at ASC
  `).all() as Ticket[];

  const ticketsByCategory = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    const categoryTickets = ticketsByCategory.get(ticket.category_id as string) || [];
    categoryTickets.push(ticket);
    ticketsByCategory.set(ticket.category_id as string, categoryTickets);
  }

  const boardCategories: KanbanBoardColumn[] = categories.map((category) => ({
    ...category,
    tickets: ticketsByCategory.get(category.id) || [],
  }));

  return { categories: boardCategories };
}
