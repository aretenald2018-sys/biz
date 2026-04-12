import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getKanbanBoardView } from '@/lib/kanban';

export async function GET() {
  const db = getDb();
  return NextResponse.json(getKanbanBoardView(db));
}
