import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const schedule = db.prepare(`
    SELECT s.*, t.title as ticket_title, t.status as ticket_status
    FROM schedules s
    LEFT JOIN tickets t ON t.id = s.ticket_id
    WHERE s.id = ?
  `).get(id);

  if (!schedule) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of ['title', 'description', 'start_date', 'end_date', 'ticket_id', 'url', 'color']) {
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

  db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const schedule = db.prepare(`
    SELECT s.*, t.title as ticket_title, t.status as ticket_status
    FROM schedules s
    LEFT JOIN tickets t ON t.id = s.ticket_id
    WHERE s.id = ?
  `).get(id);

  return NextResponse.json(schedule);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

  return NextResponse.json({ ok: true });
}
