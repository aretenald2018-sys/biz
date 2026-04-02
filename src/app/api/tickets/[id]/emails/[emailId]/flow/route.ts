import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const { emailId } = await params;
  const db = getDb();

  const steps = db.prepare(
    'SELECT * FROM email_flow_steps WHERE email_id = ? ORDER BY step_order ASC'
  ).all(emailId);

  return NextResponse.json(steps);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const { emailId } = await params;
  const db = getDb();
  const body = await request.json();

  const { step_type, actor, summary, is_current } = body;

  if (!step_type || !summary?.trim()) {
    return NextResponse.json({ error: 'step_type and summary are required' }, { status: 400 });
  }

  // Get next step_order
  const maxOrder = db.prepare(
    'SELECT MAX(step_order) as m FROM email_flow_steps WHERE email_id = ?'
  ).get(emailId) as { m: number | null };
  const nextOrder = (maxOrder?.m ?? -1) + 1;

  // If marking as current, clear other current flags
  if (is_current) {
    db.prepare('UPDATE email_flow_steps SET is_current = 0 WHERE email_id = ?').run(emailId);
  }

  const stmt = db.prepare(`
    INSERT INTO email_flow_steps (email_id, step_type, actor, summary, is_current, step_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(emailId, step_type, actor || null, summary.trim(), is_current ? 1 : 0, nextOrder);
  const step = db.prepare('SELECT * FROM email_flow_steps WHERE rowid = ?').get(result.lastInsertRowid);

  return NextResponse.json(step, { status: 201 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const { emailId } = await params;
  const db = getDb();
  const body = await request.json();

  const { id, step_type, actor, summary, is_current } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (step_type !== undefined) { fields.push('step_type = ?'); values.push(step_type); }
  if (actor !== undefined) { fields.push('actor = ?'); values.push(actor); }
  if (summary !== undefined) { fields.push('summary = ?'); values.push(summary); }
  if (is_current !== undefined) {
    if (is_current) {
      db.prepare('UPDATE email_flow_steps SET is_current = 0 WHERE email_id = ?').run(emailId);
    }
    fields.push('is_current = ?'); values.push(is_current ? 1 : 0);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now','localtime')");
  values.push(id);

  db.prepare(`UPDATE email_flow_steps SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM email_flow_steps WHERE id = ?').get(id);

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const stepId = searchParams.get('step_id');

  if (!stepId) {
    return NextResponse.json({ error: 'step_id is required' }, { status: 400 });
  }

  db.prepare('DELETE FROM email_flow_steps WHERE id = ?').run(stepId);
  return NextResponse.json({ success: true });
}
