import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

export async function POST(request: NextRequest) {
  const db = getDb();
  const formData = await request.formData();

  const file = formData.get('file') as File | null;
  const parentType = formData.get('parent_type') as string | null;
  const parentId = formData.get('parent_id') as string | null;

  if (!file || !parentType || !parentId) {
    return NextResponse.json({ error: 'file, parent_type, parent_id are required' }, { status: 400 });
  }

  if (parentType !== 'annotation' && parentType !== 'meta_annotation') {
    return NextResponse.json({ error: 'parent_type must be annotation or meta_annotation' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isImage = IMAGE_TYPES.includes(file.type) ? 1 : 0;

  const stmt = db.prepare(`
    INSERT INTO attachments (parent_type, parent_id, file_name, file_blob, file_type, file_size, is_image)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(parentType, parentId, file.name, buffer, file.type, buffer.length, isImage);

  const attachment = db.prepare(
    'SELECT id, parent_type, parent_id, file_name, file_type, file_size, is_image, created_at FROM attachments WHERE rowid = ?'
  ).get(result.lastInsertRowid);

  return NextResponse.json(attachment, { status: 201 });
}
