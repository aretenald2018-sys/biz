import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateWeeklyReport } from '@/lib/ai-generation';

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ticketId = typeof body?.ticketId === 'string' ? body.ticketId : '';
    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
    }

    const rangeDays = typeof body?.rangeDays === 'number' && body.rangeDays > 0 ? body.rangeDays : 7;
    const db = getDb();
    const ticket = db.prepare('SELECT id, title FROM tickets WHERE id = ?').get(ticketId) as { id: string; title: string } | undefined;
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const templateId = typeof body?.templateId === 'string' ? body.templateId : '';
    const template = templateId
      ? db.prepare('SELECT content FROM generation_templates WHERE id = ? AND type = ?').get(templateId, 'weekly_report') as { content: string } | undefined
      : db.prepare('SELECT content FROM generation_templates WHERE type = ? ORDER BY is_default DESC, updated_at DESC LIMIT 1').get('weekly_report') as { content: string } | undefined;

    const lowerBound = daysAgoIso(rangeDays);
    const notes = db.prepare(`
      SELECT title, content, updated_at
      FROM notes
      WHERE ticket_id = ? AND updated_at >= ?
      ORDER BY updated_at DESC
      LIMIT 80
    `).all(ticketId, lowerBound) as Array<{ title: string; content: string; updated_at: string }>;

    const emails = db.prepare(`
      SELECT subject, sender_name, body_text, sent_date
      FROM emails
      WHERE ticket_id = ? AND COALESCE(sent_date, created_at) >= ?
      ORDER BY COALESCE(sent_date, created_at) DESC
      LIMIT 80
    `).all(ticketId, lowerBound) as Array<{ subject: string | null; sender_name: string | null; body_text: string | null; sent_date: string | null }>;

    const bestPractices = db.prepare(`
      SELECT title, content
      FROM generation_best_practices
      WHERE type = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all('weekly_report') as Array<{ title: string; content: string }>;

    const markdown = await generateWeeklyReport({
      ticketTitle: ticket.title,
      templateContent: template?.content || '',
      bestPractices,
      notes,
      emails,
      rangeLabel: `최근 ${rangeDays}일`,
    });

    return NextResponse.json({ markdown });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

