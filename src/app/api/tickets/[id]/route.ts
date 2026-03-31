import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json(ticket);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
  if (body.ai_summary !== undefined) { fields.push('ai_summary = ?'); values.push(body.ai_summary); }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now','localtime')");
  values.push(id);

  db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
