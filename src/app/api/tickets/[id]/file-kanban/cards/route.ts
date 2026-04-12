import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  createTicketFileKanbanCard,
  listTicketFileKanbanCards,
} from '@/lib/ticket-file-kanban';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json(listTicketFileKanbanCards(db, id));
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

  const body = await request.json();

  try {
    const card = createTicketFileKanbanCard(db, id, {
      category_id: typeof body.category_id === 'string' ? body.category_id : '',
      file_name: typeof body.file_name === 'string' ? body.file_name : undefined,
      description: typeof body.description === 'string' ? body.description : null,
      email_attachment_id: typeof body.email_attachment_id === 'string' ? body.email_attachment_id : null,
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
