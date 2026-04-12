import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assignTicketPlacement } from '@/lib/kanban';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let tickets;
  if (status) {
    tickets = db.prepare(`
      SELECT t.*, COUNT(e.id) as email_count
      FROM tickets t
      LEFT JOIN emails e ON e.ticket_id = t.id
      WHERE t.status = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all(status);
  } else {
    tickets = db.prepare(`
      SELECT t.*, COUNT(e.id) as email_count
      FROM tickets t
      LEFT JOIN emails e ON e.ticket_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all();
  }

  return NextResponse.json(tickets);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const title = String(body.title || '').trim();
  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const status = body.status;
  const categoryId = typeof body.category_id === 'string' ? body.category_id.trim() : undefined;
  const position = typeof body.position === 'number' ? body.position : undefined;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO tickets (title, description, status)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(title, description, status || '신규');
  const insertedTicket = db.prepare('SELECT id, status FROM tickets WHERE rowid = ?').get(result.lastInsertRowid) as
    | { id: string; status: string }
    | undefined;

  if (!insertedTicket) {
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }

  assignTicketPlacement(db, {
    ticketId: insertedTicket.id,
    status: insertedTicket.status,
    categoryId,
    position,
  });

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(insertedTicket.id);
  return NextResponse.json(ticket, { status: 201 });
}
