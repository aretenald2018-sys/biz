import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateSummary } from '@/lib/ai-client';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const emails = db.prepare(
    'SELECT subject, sender_name, body_text, sent_date FROM emails WHERE ticket_id = ? ORDER BY sent_date ASC, created_at ASC'
  ).all(id) as { subject: string | null; sender_name: string | null; body_text: string | null; sent_date: string | null }[];

  if (emails.length === 0) {
    return NextResponse.json({ error: 'No emails to summarize' }, { status: 400 });
  }

  try {
    const summary = await generateSummary(emails);

    db.prepare("UPDATE tickets SET ai_summary = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(summary, id);

    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `AI summary failed: ${message}` }, { status: 500 });
  }
}
