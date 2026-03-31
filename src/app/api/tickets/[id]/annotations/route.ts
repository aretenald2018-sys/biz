import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const emailId = searchParams.get('email_id');

  if (!emailId) {
    return NextResponse.json({ error: 'email_id is required' }, { status: 400 });
  }

  const annotations = db.prepare(
    'SELECT * FROM annotations WHERE email_id = ? ORDER BY start_offset ASC'
  ).all(emailId) as { id: string }[];

  const getReplies = db.prepare(
    'SELECT * FROM annotation_replies WHERE annotation_id = ? ORDER BY created_at ASC'
  );
  const getMetaAnnotations = db.prepare(
    'SELECT * FROM meta_annotations WHERE annotation_id = ? ORDER BY start_offset ASC'
  );
  const getMetaReplies = db.prepare(
    'SELECT * FROM meta_annotation_replies WHERE meta_annotation_id = ? ORDER BY created_at ASC'
  );
  const getAttachments = db.prepare(
    "SELECT id, parent_type, parent_id, file_name, file_type, file_size, is_image, created_at FROM attachments WHERE parent_type = ? AND parent_id = ?"
  );

  const annotationsWithAll = annotations.map(ann => {
    const metas = (getMetaAnnotations.all(ann.id) as { id: string }[]).map(m => ({
      ...m,
      replies: getMetaReplies.all(m.id),
      attachments: getAttachments.all('meta_annotation', m.id),
    }));

    return {
      ...ann,
      replies: getReplies.all(ann.id),
      meta_annotations: metas,
      attachments: getAttachments.all('annotation', ann.id),
    };
  });

  return NextResponse.json(annotationsWithAll);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const db = getDb();
  const body = await request.json();

  const { email_id, start_offset, end_offset, selected_text, note, color } = body;

  if (!email_id || start_offset === undefined || end_offset === undefined || !selected_text || !note) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const stmt = db.prepare(`
    INSERT INTO annotations (email_id, start_offset, end_offset, selected_text, note, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(email_id, start_offset, end_offset, selected_text, note, color || '#5ec4d4');
  const annotation = db.prepare('SELECT * FROM annotations WHERE rowid = ?').get(result.lastInsertRowid);

  return NextResponse.json(annotation, { status: 201 });
}
