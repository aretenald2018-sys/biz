import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseEmailFile } from '@/lib/email-parser';
import { normalizeCid } from '@/lib/cid-utils';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

function sanitizeContentId(value: unknown): string | null {
  return normalizeCid(value) || null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const emails = db.prepare(
    'SELECT id, ticket_id, file_name, subject, sender_name, sender_email, recipients, cc_list, body_text, body_html, sent_date, parsed_participants, parent_note_id, parent_email_id, created_at FROM emails WHERE ticket_id = ? ORDER BY sent_date ASC, created_at ASC',
  ).all(id) as Array<Record<string, unknown>>;

  const emailIds = emails.map((email) => email.id as string);
  const attachmentsByEmailId = new Map<string, unknown[]>();

  if (emailIds.length > 0) {
    const placeholders = emailIds.map(() => '?').join(', ');
    const attachments = db.prepare(`
      SELECT id, email_id, file_name, file_type, file_size, is_image, content_id, created_at
      FROM email_attachments
      WHERE email_id IN (${placeholders})
      ORDER BY created_at ASC
    `).all(...emailIds) as Array<Record<string, unknown> & { email_id: string }>;

    for (const attachment of attachments) {
      const bucket = attachmentsByEmailId.get(attachment.email_id) || [];
      bucket.push(attachment);
      attachmentsByEmailId.set(attachment.email_id, bucket);
    }
  }

  for (const email of emails) {
    (email as Record<string, unknown>).email_attachments = attachmentsByEmailId.get(email.id as string) || [];
  }

  return NextResponse.json(emails);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const parsed = parseEmailFile(buffer, file.name);

  const result = db.prepare(`
    INSERT INTO emails (ticket_id, file_name, file_blob, subject, sender_name, sender_email, recipients, cc_list, body_text, body_html, sent_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    file.name,
    Buffer.from(buffer),
    parsed.subject,
    parsed.senderName,
    parsed.senderEmail,
    JSON.stringify(parsed.recipients),
    JSON.stringify(parsed.ccList),
    parsed.bodyText,
    parsed.bodyHtml,
    parsed.sentDate,
  );

  const email = db.prepare('SELECT id FROM emails WHERE rowid = ?').get(result.lastInsertRowid) as { id: string };

  if (parsed.attachments.length > 0) {
    const insertAttachment = db.prepare(`
      INSERT INTO email_attachments (email_id, file_name, file_blob, file_type, file_size, is_image, content_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const attachment of parsed.attachments) {
      const isImage = IMAGE_TYPES.includes(attachment.contentType) ? 1 : 0;
      insertAttachment.run(
        email.id,
        attachment.fileName,
        attachment.content,
        attachment.contentType,
        attachment.size,
        isImage,
        sanitizeContentId(attachment.contentId),
      );
    }
  }

  const allParticipants = [
    { name: parsed.senderName || 'Unknown', email: parsed.senderEmail || '' },
    ...parsed.recipients.map((recipient) => ({ name: recipient.name, email: recipient.email })),
    ...parsed.ccList.map((recipient) => ({ name: recipient.name, email: recipient.email })),
  ];

  const upsertParticipant = db.prepare(`
    INSERT INTO participants (ticket_id, name, email)
    VALUES (?, ?, ?)
    ON CONFLICT(ticket_id, email) DO UPDATE SET name = excluded.name
  `);

  for (const participant of allParticipants) {
    if (!participant.email) continue;
    upsertParticipant.run(id, participant.name, participant.email);
  }

  const getParticipant = db.prepare('SELECT id FROM participants WHERE ticket_id = ? AND email = ?');
  const insertEdge = db.prepare(`
    INSERT OR IGNORE INTO communication_edges (ticket_id, from_participant_id, to_participant_id, email_id)
    VALUES (?, ?, ?, ?)
  `);
  const senderParticipant = parsed.senderEmail
    ? (getParticipant.get(id, parsed.senderEmail) as { id: string } | undefined)
    : undefined;

  if (senderParticipant) {
    const allRecipients = [...parsed.recipients, ...parsed.ccList];
    for (const recipient of allRecipients) {
      if (!recipient.email) continue;
      const recipientParticipant = getParticipant.get(id, recipient.email) as { id: string } | undefined;
      if (recipientParticipant) {
        insertEdge.run(id, senderParticipant.id, recipientParticipant.id, email.id);
      }
    }
  }

  const inserted = db.prepare(
    'SELECT id, ticket_id, file_name, subject, sender_name, sender_email, recipients, cc_list, body_text, body_html, sent_date, parsed_participants, created_at FROM emails WHERE rowid = ?',
  ).get(result.lastInsertRowid) as Record<string, unknown>;

  inserted.email_attachments = db.prepare(
    'SELECT id, email_id, file_name, file_type, file_size, is_image, content_id, created_at FROM email_attachments WHERE email_id = ?',
  ).all(email.id);

  return NextResponse.json(inserted, { status: 201 });
}
