import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const contract = db.prepare('SELECT id FROM contracts WHERE id = ?').get(id);
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const category = formData.get('category') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!category || !['final_contract', 'related_document', 'correspondence'].includes(category)) {
    return NextResponse.json(
      { error: 'category must be one of: final_contract, related_document, correspondence' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const stmt = db.prepare(`
    INSERT INTO contract_files (contract_id, file_category, file_name, file_blob, file_type, file_size)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(id, category, file.name, buffer, file.type || 'application/octet-stream', buffer.length);

  const inserted = db.prepare(
    'SELECT id, contract_id, file_category, file_name, file_type, file_size, created_at FROM contract_files WHERE rowid = ?'
  ).get(result.lastInsertRowid);

  return NextResponse.json(inserted, { status: 201 });
}
