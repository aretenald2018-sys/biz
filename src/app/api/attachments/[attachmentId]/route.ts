import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const db = getDb();

  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId) as {
    file_blob: Buffer;
    file_name: string;
    file_type: string;
    is_image: number;
  } | undefined;

  if (!attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = new Uint8Array(attachment.file_blob);
  return new NextResponse(body, {
    headers: {
      'Content-Type': attachment.file_type,
      'Content-Disposition': attachment.is_image
        ? 'inline'
        : `attachment; filename="${encodeURIComponent(attachment.file_name)}"`,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const db = getDb();

  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
  return NextResponse.json({ success: true });
}
