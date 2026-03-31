import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string; replyId: string }> }
) {
  const { replyId } = await params;
  const db = getDb();
  const body = await request.json();

  if (!body.note?.trim()) {
    return NextResponse.json({ error: 'Note is required' }, { status: 400 });
  }

  db.prepare("UPDATE annotation_replies SET note = ?, updated_at = datetime('now','localtime') WHERE id = ?")
    .run(body.note.trim(), replyId);

  const updated = db.prepare('SELECT * FROM annotation_replies WHERE id = ?').get(replyId);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string; replyId: string }> }
) {
  const { replyId } = await params;
  const db = getDb();

  db.prepare('DELETE FROM annotation_replies WHERE id = ?').run(replyId);
  return NextResponse.json({ success: true });
}
