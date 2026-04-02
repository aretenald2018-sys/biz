import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const { emailId } = await params;
  const db = getDb();
  const email = db.prepare(
    'SELECT id, ticket_id, file_name, subject, sender_name, sender_email, recipients, cc_list, body_text, body_html, sent_date, parsed_participants, parent_note_id, created_at FROM emails WHERE id = ?'
  ).get(emailId);

  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  return NextResponse.json(email);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const { emailId } = await params;
  const db = getDb();
  const body = await request.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.parent_note_id !== undefined) { fields.push('parent_note_id = ?'); values.push(body.parent_note_id); }
  if (body.parent_email_id !== undefined) { fields.push('parent_email_id = ?'); values.push(body.parent_email_id); }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  values.push(emailId);
  db.prepare(`UPDATE emails SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM emails WHERE id = ?').get(emailId);
  return NextResponse.json(updated);
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
