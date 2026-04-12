import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let schedules;
  if (from && to) {
    schedules = db.prepare(`
      SELECT s.*, t.title as ticket_title, t.status as ticket_status
      FROM schedules s
      JOIN tickets t ON t.id = s.ticket_id
      WHERE s.start_date <= ? AND s.end_date >= ?
      ORDER BY s.start_date ASC
    `).all(to, from);
  } else {
    schedules = db.prepare(`
      SELECT s.*, t.title as ticket_title, t.status as ticket_status
      FROM schedules s
      JOIN tickets t ON t.id = s.ticket_id
      ORDER BY s.start_date ASC
    `).all();
  }

  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const title = String(body.title || '').trim();
  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const startDate = String(body.start_date || '').trim();
  const endDate = String(body.end_date || '').trim();
  const ticketId = String(body.ticket_id || '').trim();
  const url = typeof body.url === 'string' ? body.url.trim() : null;
  const color = typeof body.color === 'string' ? body.color.trim() : '#5ec4d4';

  if (!title || !startDate || !endDate || !ticketId) {
    return NextResponse.json({ error: 'title, start_date, end_date, ticket_id are required' }, { status: 400 });
  }

  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO schedules (title, description, start_date, end_date, ticket_id, url, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    title,
    description,
    startDate,
    endDate,
    ticketId,
    url,
    color || '#5ec4d4'
  );

  const schedule = db.prepare(`
    SELECT s.*, t.title as ticket_title, t.status as ticket_status
    FROM schedules s
    JOIN tickets t ON t.id = s.ticket_id
    WHERE s.rowid = ?
  `).get(result.lastInsertRowid);

  return NextResponse.json(schedule, { status: 201 });
}
