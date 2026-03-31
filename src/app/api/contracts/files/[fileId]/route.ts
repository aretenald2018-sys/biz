import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const db = getDb();

  const file = db.prepare(
    'SELECT * FROM contract_files WHERE id = ?'
  ).get(fileId) as { file_blob: Buffer; file_type: string; file_name: string } | undefined;

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const body = new Uint8Array(file.file_blob);
  return new NextResponse(body, {
    headers: {
      'Content-Type': file.file_type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.file_name)}"`,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM contract_files WHERE id = ?').get(fileId);
  if (!existing) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  db.prepare('DELETE FROM contract_files WHERE id = ?').run(fileId);
  return NextResponse.json({ success: true });
}
