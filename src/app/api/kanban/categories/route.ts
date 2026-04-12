import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const categories = db.prepare(`
    SELECT *
    FROM kanban_categories
    ORDER BY position ASC, created_at ASC
  `).all();

  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const name = String(body.name || '').trim();
  const color = String(body.color || '#00AAD2').trim() || '#00AAD2';

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const maxPosition = db.prepare('SELECT COALESCE(MAX(position), -1) as position FROM kanban_categories').get() as { position: number };
  const result = db.prepare(`
    INSERT INTO kanban_categories (name, color, position)
    VALUES (?, ?, ?)
  `).run(name, color, maxPosition.position + 1);

  const category = db.prepare('SELECT * FROM kanban_categories WHERE rowid = ?').get(result.lastInsertRowid);
  if (!category) {
    return NextResponse.json({ error: 'Insert succeeded but category not found' }, { status: 500 });
  }
  return NextResponse.json(category, { status: 201 });
}
