import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  deleteTicketFileKanbanCard,
  updateTicketFileKanbanCard,
} from '@/lib/ticket-file-kanban';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id, cardId } = await params;
  const db = getDb();
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const body = await request.json();

  try {
    const card = updateTicketFileKanbanCard(db, id, cardId, {
      category_id: typeof body.category_id === 'string' ? body.category_id : undefined,
      file_name: typeof body.file_name === 'string' ? body.file_name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      position: typeof body.position === 'number' ? body.position : undefined,
      email_attachment_id: typeof body.email_attachment_id === 'string' ? body.email_attachment_id : undefined,
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    return NextResponse.json(card);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id, cardId } = await params;
  const db = getDb();
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  deleteTicketFileKanbanCard(db, id, cardId);
  return NextResponse.json({ ok: true });
}
