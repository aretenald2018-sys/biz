import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const participants = db.prepare(
    'SELECT * FROM participants WHERE ticket_id = ?'
  ).all(id);

  const edges = db.prepare(
    'SELECT * FROM communication_edges WHERE ticket_id = ?'
  ).all(id);

  return NextResponse.json({ participants, edges });
}
