import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  deleteTicketFileKanbanCategory,
  updateTicketFileKanbanCategory,
} from '@/lib/ticket-file-kanban';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const { id, catId } = await params;
  const db = getDb();
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const body = await request.json();

  try {
    const category = updateTicketFileKanbanCategory(db, id, catId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      color: typeof body.color === 'string' ? body.color : undefined,
      position: typeof body.position === 'number' ? body.position : undefined,
      is_default: typeof body.is_default === 'number' ? body.is_default : undefined,
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const { id, catId } = await params;
  const db = getDb();
  const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  try {
    deleteTicketFileKanbanCategory(db, id, catId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
