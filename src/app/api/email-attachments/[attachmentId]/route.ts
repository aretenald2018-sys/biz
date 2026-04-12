import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildContentDisposition } from '@/lib/http-disposition';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const db = getDb();

  const attachment = db.prepare('SELECT * FROM email_attachments WHERE id = ?').get(attachmentId) as {
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
        ? buildContentDisposition(attachment.file_name, 'inline')
        : buildContentDisposition(attachment.file_name, 'attachment'),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
