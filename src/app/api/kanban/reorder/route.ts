import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { reorderKanbanTickets } from '@/lib/kanban';
import type { ReorderKanbanTicketInput } from '@/types/kanban';

function parseItems(body: unknown) {
  const items = Array.isArray((body as { tickets?: unknown[] } | null)?.tickets)
    ? (body as { tickets: unknown[] }).tickets
    : [];

  return items.reduce<ReorderKanbanTicketInput[]>((acc, item) => {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { ticketId?: unknown }).ticketId === 'string' &&
      typeof (item as { category_id?: unknown }).category_id === 'string' &&
      typeof (item as { position?: unknown }).position === 'number'
    ) {
      acc.push({
        ticketId: (item as { ticketId: string }).ticketId,
        category_id: (item as { category_id: string }).category_id,
        position: Math.max(0, Math.trunc((item as { position: number }).position)),
      });
    }

    return acc;
  }, []);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json().catch(() => null);
  const tickets = parseItems(body);

  if (tickets.length === 0) {
    return NextResponse.json({ error: 'tickets are required' }, { status: 400 });
  }

  reorderKanbanTickets(db, tickets);
  return NextResponse.json({ ok: true });
}
