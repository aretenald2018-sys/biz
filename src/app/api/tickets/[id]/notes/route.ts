import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const notes = db.prepare(
    'SELECT * FROM notes WHERE ticket_id = ? ORDER BY updated_at DESC'
  ).all(id);

  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();

  const title = body.title?.trim() || 'Untitled';
  const content = body.content || '';

  const stmt = db.prepare(`
    INSERT INTO notes (ticket_id, title, content) VALUES (?, ?, ?)
  `);

  const result = stmt.run(id, title, content);
  const note = db.prepare('SELECT * FROM notes WHERE rowid = ?').get(result.lastInsertRowid);

  return NextResponse.json(note, { status: 201 });
}
