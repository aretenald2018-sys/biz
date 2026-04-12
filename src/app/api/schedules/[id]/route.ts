import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const schedule = db.prepare(`
    SELECT s.*, t.title as ticket_title, t.status as ticket_status
    FROM schedules s
    JOIN tickets t ON t.id = s.ticket_id
    WHERE s.id = ?
  `).get(id);

  if (!schedule) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

async function updateSchedule(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const existing = db.prepare('SELECT id FROM schedules WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.start_date !== undefined) { fields.push('start_date = ?'); values.push(body.start_date); }
  if (body.end_date !== undefined) { fields.push('end_date = ?'); values.push(body.end_date); }
  if (body.url !== undefined) { fields.push('url = ?'); values.push(body.url); }
  if (body.color !== undefined) { fields.push('color = ?'); values.push(body.color); }

  if (Object.prototype.hasOwnProperty.call(body, 'ticket_id')) {
    const ticketId = typeof body.ticket_id === 'string' ? body.ticket_id.trim() : '';
    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 });
    }

    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 400 });
    }

    fields.push('ticket_id = ?');
    values.push(ticketId);
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
    JOIN tickets t ON t.id = s.ticket_id
    WHERE s.id = ?
  `).get(id);

  return NextResponse.json(schedule);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return updateSchedule(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return updateSchedule(request, context);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

  return NextResponse.json({ ok: true });
}
