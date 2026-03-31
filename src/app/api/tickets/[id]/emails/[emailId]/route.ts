import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const { emailId } = await params;
  const db = getDb();
  const email = db.prepare(
    'SELECT id, ticket_id, file_name, subject, sender_name, sender_email, recipients, cc_list, body_text, body_html, sent_date, parsed_participants, created_at FROM emails WHERE id = ?'
  ).get(emailId);

  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  return NextResponse.json(email);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const { emailId } = await params;
  const db = getDb();

  db.prepare('DELETE FROM emails WHERE id = ?').run(emailId);
  return NextResponse.json({ success: true });
}
