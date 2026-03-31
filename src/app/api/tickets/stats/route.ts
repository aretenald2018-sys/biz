import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number };
  const byStatus = db.prepare(
    'SELECT status, COUNT(*) as count FROM tickets GROUP BY status'
  ).all() as { status: string; count: number }[];

  const recentTickets = db.prepare(
    'SELECT id, title, status, created_at FROM tickets ORDER BY created_at DESC LIMIT 5'
  ).all();

  const emailCount = db.prepare('SELECT COUNT(*) as count FROM emails').get() as { count: number };

  const ticketsWithEmails = db.prepare(`
    SELECT t.id, t.title, t.status, t.created_at, COUNT(e.id) as email_count
    FROM tickets t
    LEFT JOIN emails e ON e.ticket_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();

  return NextResponse.json({
    total: total.count,
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
    recentTickets,
    emailCount: emailCount.count,
    ticketsWithEmails,
  });
}
