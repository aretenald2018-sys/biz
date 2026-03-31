import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json([]);
  }

  const db = getDb();
  const pattern = `%${q.trim()}%`;

  // Search tickets
  const tickets = db.prepare(`
    SELECT id, title, description, status, created_at
    FROM tickets
    WHERE title LIKE ? OR description LIKE ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(pattern, pattern) as { id: string; title: string; description: string | null; status: string; created_at: string }[];

  // Search emails
  const emails = db.prepare(`
    SELECT e.id, e.ticket_id, e.subject, e.sender_name, e.body_text, t.title as ticket_title
    FROM emails e
    JOIN tickets t ON t.id = e.ticket_id
    WHERE e.subject LIKE ? OR e.sender_name LIKE ? OR e.body_text LIKE ?
    ORDER BY e.created_at DESC
    LIMIT 10
  `).all(pattern, pattern, pattern) as { id: string; ticket_id: string; subject: string | null; sender_name: string | null; ticket_title: string }[];

  const results = [
    ...tickets.map(t => ({
      type: 'ticket' as const,
      id: t.id,
      ticketId: t.id,
      title: t.title,
      subtitle: `${t.status} | ${t.created_at}`,
      status: t.status,
    })),
    ...emails.map(e => ({
      type: 'email' as const,
      id: e.id,
      ticketId: e.ticket_id,
      title: e.subject || '(No Subject)',
      subtitle: `${e.sender_name || 'Unknown'} — Ticket: ${e.ticket_title}`,
    })),
  ];

  return NextResponse.json(results);
}
