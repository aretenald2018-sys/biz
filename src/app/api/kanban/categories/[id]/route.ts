import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureUncategorizedCategory, getNextTicketPosition } from '@/lib/kanban';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of ['name', 'color', 'position']) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now','localtime')");
  values.push(id);
  db.prepare(`UPDATE kanban_categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const category = db.prepare('SELECT * FROM kanban_categories WHERE id = ?').get(id);
  return NextResponse.json(category);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const category = db.prepare('SELECT * FROM kanban_categories WHERE id = ?').get(id);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const tickets = db.prepare(`
    SELECT id
    FROM tickets
    WHERE category_id = ?
    ORDER BY position ASC, created_at ASC
  `).all(id) as Array<{ id: string }>;

  if (tickets.length > 0) {
    const fallbackCategory = ensureUncategorizedCategory(db, { excludingId: id });
    const updateTicket = db.prepare(`
      UPDATE tickets
      SET category_id = ?, position = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `);

    let nextPosition = getNextTicketPosition(db, fallbackCategory.id);
    for (const ticket of tickets) {
      updateTicket.run(fallbackCategory.id, nextPosition, ticket.id);
      nextPosition += 1;
    }
  }

  db.prepare('DELETE FROM kanban_categories WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
