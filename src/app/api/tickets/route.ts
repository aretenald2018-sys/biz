import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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
  const { title, description, status } = body;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO tickets (title, description, status)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(title, description || null, status || '신규');
  const ticket = db.prepare('SELECT * FROM tickets WHERE rowid = ?').get(result.lastInsertRowid);

  return NextResponse.json(ticket, { status: 201 });
}
