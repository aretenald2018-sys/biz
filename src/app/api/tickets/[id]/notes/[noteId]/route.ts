import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { noteId } = await params;
  const db = getDb();

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(note);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { noteId } = await params;
  const db = getDb();
  const body = await request.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.content !== undefined) { fields.push('content = ?'); values.push(body.content); }
  if (body.parent_email_id !== undefined) { fields.push('parent_email_id = ?'); values.push(body.parent_email_id); }
  if (body.parent_note_id !== undefined) { fields.push('parent_note_id = ?'); values.push(body.parent_note_id); }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now','localtime')");
  values.push(noteId);

  db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { noteId } = await params;
  const db = getDb();

  db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
  return NextResponse.json({ success: true });
}
