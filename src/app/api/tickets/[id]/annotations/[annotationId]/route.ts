import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const { annotationId } = await params;
  const db = getDb();
  const body = await request.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.note !== undefined) { fields.push('note = ?'); values.push(body.note); }
  if (body.color !== undefined) { fields.push('color = ?'); values.push(body.color); }
  if (body.resolved !== undefined) { fields.push('resolved = ?'); values.push(body.resolved); }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now','localtime')");
  values.push(annotationId);

  db.prepare(`UPDATE annotations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM annotations WHERE id = ?').get(annotationId);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const { annotationId } = await params;
  const db = getDb();

  db.prepare('DELETE FROM annotations WHERE id = ?').run(annotationId);
  return NextResponse.json({ success: true });
}

// POST: Add a reply to an annotation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const { annotationId } = await params;
  const db = getDb();
  const body = await request.json();

  if (!body.note?.trim()) {
    return NextResponse.json({ error: 'Note is required' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO annotation_replies (annotation_id, note)
    VALUES (?, ?)
  `);

  const result = stmt.run(annotationId, body.note.trim());
  const reply = db.prepare('SELECT * FROM annotation_replies WHERE rowid = ?').get(result.lastInsertRowid);

  return NextResponse.json(reply, { status: 201 });
}
