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
      LEFT JOIN tickets t ON t.id = s.ticket_id
      WHERE s.start_date <= ? AND s.end_date >= ?
      ORDER BY s.start_date ASC
    `).all(to, from);
  } else {
    schedules = db.prepare(`
      SELECT s.*, t.title as ticket_title, t.status as ticket_status
      FROM schedules s
      LEFT JOIN tickets t ON t.id = s.ticket_id
      ORDER BY s.start_date ASC
    `).all();
  }

  return NextResponse.json(schedules);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { title, description, start_date, end_date, ticket_id, url, color } = body;

  if (!title || !start_date || !end_date) {
    return NextResponse.json({ error: 'title, start_date, end_date are required' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO schedules (title, description, start_date, end_date, ticket_id, url, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    title,
    description || null,
    start_date,
    end_date,
    ticket_id || null,
    url || null,
    color || '#5ec4d4'
  );

  const schedule = db.prepare(`
    SELECT s.*, t.title as ticket_title, t.status as ticket_status
    FROM schedules s
    LEFT JOIN tickets t ON t.id = s.ticket_id
    WHERE s.rowid = ?
  `).get(result.lastInsertRowid);

  return NextResponse.json(schedule, { status: 201 });
}
