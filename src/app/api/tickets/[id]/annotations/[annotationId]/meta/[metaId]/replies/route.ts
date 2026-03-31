import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string; metaId: string }> }
) {
  const { metaId } = await params;
  const db = getDb();
  const body = await request.json();

  if (!body.note?.trim()) {
    return NextResponse.json({ error: 'Note is required' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO meta_annotation_replies (meta_annotation_id, note)
    VALUES (?, ?)
  `);

  const result = stmt.run(metaId, body.note.trim());
  const reply = db.prepare('SELECT * FROM meta_annotation_replies WHERE rowid = ?').get(result.lastInsertRowid);

  return NextResponse.json(reply, { status: 201 });
}
