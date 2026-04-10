import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseEmailFile } from '@/lib/email-parser';
import { parseParticipants } from '@/lib/ai-client';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const emails = db.prepare(
    'SELECT id, ticket_id, file_name, subject, sender_name, sender_email, recipients, cc_list, body_text, body_html, sent_date, parsed_participants, parent_note_id, parent_email_id, created_at FROM emails WHERE ticket_id = ? ORDER BY sent_date ASC, created_at ASC'
  ).all(id) as Array<Record<string, unknown>>;

  // Attach email attachment metadata (without blob)
  const getAttachments = db.prepare(
    'SELECT id, email_id, file_name, file_type, file_size, is_image, content_id, created_at FROM email_attachments WHERE email_id = ?'
  );
  for (const email of emails) {
    (email as Record<string, unknown>).email_attachments = getAttachments.all(email.id as string);
  }

  return NextResponse.json(emails);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  // --- Incremental update: detect duplicate thread and append only new content ---
  function stripRePrefix(s: string | null): string {
    return (s || '').replace(/^(RE:|Re:|FW:|Fw:|답장:|전달:)\s*/gi, '').trim();
  }

  const strippedSubject = stripRePrefix(parsed.subject);

  const existing = db.prepare(
    'SELECT id, subject, body_text, body_html FROM emails WHERE ticket_id = ? ORDER BY created_at DESC'
  ).all(id) as { id: string; subject: string | null; body_text: string | null; body_html: string | null }[];

  let matchedEmail: { id: string; subject: string | null; body_text: string | null; body_html: string | null } | null = null;
  for (const ex of existing) {
    const exSubject = stripRePrefix(ex.subject);
    if (exSubject && strippedSubject && exSubject === strippedSubject) {
      matchedEmail = ex;
      break;
    }
  }

  if (matchedEmail && parsed.bodyText && matchedEmail.body_text) {
    const oldText = matchedEmail.body_text.trim();
    const newText = parsed.bodyText.trim();
    const idx = newText.indexOf(oldText);

    if (idx > 0) {
      const incrementalText = newText.substring(0, idx).trim();
      const newFullText = incrementalText + '\n\n' + '\u2500'.repeat(40) + '\n\n' + oldText;
      const newFullHtml = parsed.bodyHtml || matchedEmail.body_html;

      db.prepare(
        'UPDATE emails SET body_text = ?, body_html = ?, file_blob = ? WHERE id = ?'
      ).run(newFullText, newFullHtml, Buffer.from(buffer), matchedEmail.id);

      return NextResponse.json({ email: { id: matchedEmail.id }, incremental: true });
    }
  }
  // --- End incremental update ---

  const stmt = db.prepare(`
    INSERT INTO emails (ticket_id, file_name, file_blob, subject, sender_name, sender_email, recipients, cc_list, body_text, body_html, sent_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
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
    parsed.sentDate
  );

  // Save email attachments
  const email = db.prepare('SELECT id FROM emails WHERE rowid = ?').get(result.lastInsertRowid) as { id: string };
  if (parsed.attachments.length > 0) {
    const insertAttachment = db.prepare(`
      INSERT INTO email_attachments (email_id, file_name, file_blob, file_type, file_size, is_image, content_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const att of parsed.attachments) {
      const isImage = IMAGE_TYPES.includes(att.contentType) ? 1 : 0;
      insertAttachment.run(email.id, att.fileName, att.content, att.contentType, att.size, isImage, att.contentId || null);
    }
  }

  // Register participants
  const allParticipants = [
    { name: parsed.senderName || 'Unknown', email: parsed.senderEmail || '' },
    ...parsed.recipients.map(r => ({ name: r.name, email: r.email })),
    ...parsed.ccList.map(r => ({ name: r.name, email: r.email })),
  ];

  const upsertParticipant = db.prepare(`
    INSERT INTO participants (ticket_id, name, email)
    VALUES (?, ?, ?)
    ON CONFLICT(ticket_id, email) DO UPDATE SET name = excluded.name
  `);

  for (const p of allParticipants) {
    if (p.email) {
      upsertParticipant.run(id, p.name, p.email);
    }
  }

  // Create communication edges
  const getParticipant = db.prepare('SELECT id FROM participants WHERE ticket_id = ? AND email = ?');
  const insertEdge = db.prepare(`
    INSERT OR IGNORE INTO communication_edges (ticket_id, from_participant_id, to_participant_id, email_id)
    VALUES (?, ?, ?, ?)
  `);

  const senderParticipant = parsed.senderEmail ? getParticipant.get(id, parsed.senderEmail) as { id: string } | undefined : undefined;

  if (senderParticipant) {
    const allRecipients = [...parsed.recipients, ...parsed.ccList];
    for (const r of allRecipients) {
      if (r.email) {
        const recipientParticipant = getParticipant.get(id, r.email) as { id: string } | undefined;
        if (recipientParticipant) {
          insertEdge.run(id, senderParticipant.id, recipientParticipant.id, email.id);
        }
      }
    }
  }

  // AI-based participant enrichment (async, best-effort)
  if (parsed.bodyText) {
    try {
      const aiParticipants = await parseParticipants(parsed.bodyText);
      if (aiParticipants.length > 0) {
        // Store parsed participants JSON in the email record
        db.prepare('UPDATE emails SET parsed_participants = ? WHERE rowid = ?')
          .run(JSON.stringify(aiParticipants), result.lastInsertRowid);

        // Enrich participant records with title/department/organization
        const updateParticipant = db.prepare(`
          UPDATE participants SET title = ?, department = ?, organization = ?
          WHERE ticket_id = ? AND name = ?
        `);
        for (const ap of aiParticipants) {
          if (ap.name && (ap.title || ap.department || ap.organization)) {
            updateParticipant.run(
              ap.title || null,
              ap.department || null,
              ap.organization || null,
              id,
              ap.name
            );
          }
        }
      }
    } catch {
      // AI parsing is best-effort, don't fail the upload
    }
  }

  const inserted = db.prepare(
    'SELECT id, ticket_id, file_name, subject, sender_name, sender_email, recipients, cc_list, body_text, body_html, sent_date, parsed_participants, created_at FROM emails WHERE rowid = ?'
  ).get(result.lastInsertRowid) as Record<string, unknown>;

  // Include email attachments metadata in response
  const getEmailAttachments = db.prepare(
    'SELECT id, email_id, file_name, file_type, file_size, is_image, content_id, created_at FROM email_attachments WHERE email_id = ?'
  );
  inserted.email_attachments = getEmailAttachments.all(email.id);

  return NextResponse.json(inserted, { status: 201 });
}
