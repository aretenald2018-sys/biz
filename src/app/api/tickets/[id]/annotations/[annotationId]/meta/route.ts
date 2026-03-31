import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const { annotationId } = await params;
  const db = getDb();

  const metas = db.prepare(
    'SELECT * FROM meta_annotations WHERE annotation_id = ? ORDER BY start_offset ASC'
  ).all(annotationId) as { id: string }[];

  const getReplies = db.prepare(
    'SELECT * FROM meta_annotation_replies WHERE meta_annotation_id = ? ORDER BY created_at ASC'
  );
  const getAttachments = db.prepare(
    "SELECT id, parent_type, parent_id, file_name, file_type, file_size, is_image, created_at FROM attachments WHERE parent_type = 'meta_annotation' AND parent_id = ?"
  );

  const result = metas.map(m => ({
    ...m,
    replies: getReplies.all(m.id),
    attachments: getAttachments.all(m.id),
  }));

  return NextResponse.json(result);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const { annotationId } = await params;
  const db = getDb();
  const body = await request.json();

  const { start_offset, end_offset, selected_text, note, color } = body;

  if (start_offset === undefined || end_offset === undefined || !selected_text || !note) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO meta_annotations (annotation_id, start_offset, end_offset, selected_text, note, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(annotationId, start_offset, end_offset, selected_text, note, color || '#5ec4d4');
  const meta = db.prepare('SELECT * FROM meta_annotations WHERE rowid = ?').get(result.lastInsertRowid);

  return NextResponse.json(meta, { status: 201 });
}
