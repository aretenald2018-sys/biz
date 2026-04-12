import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { reorderTicketFileKanbanCards } from '@/lib/ticket-file-kanban';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const body = await request.json();
  const cards = Array.isArray(body.cards) ? body.cards : [];

  if (cards.length === 0) {
    return NextResponse.json({ error: 'cards are required' }, { status: 400 });
  }

  try {
    reorderTicketFileKanbanCards(db, id, cards);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
